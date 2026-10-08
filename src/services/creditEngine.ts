/**
 * src/services/creditEngine.ts
 *
 * ChatBox AI — Dual-Wallet Credit Engine & Quota Enforcement
 * 1:1 Parity with Website (lib/credit-engine.js, lib/model-catalog.js, lib/planUtils-server.js).
 *
 * DUAL WALLET RULES:
 * 1. Free Models -> Deduct from `credits` (Daily Free pool: 5,000/day reset at midnight)
 * 2. Paid Models -> Deduct from `paid_credits` (Monthly Paid pool: 30k for Pro, 150k for Max)
 * 3. Daily reset -> if user.last_daily_reset !== today, reset `credits` to 5,000
 */

import { databases, DB_ID, USERS_COLLECTION_ID, IMAGE_GENERATION_COLLECTION_ID, USAGE_LOGS_COLLECTION_ID, Query } from '@/config/appwrite';
import { UserProfile } from './userService';
import { normalizePlan, canAccessModel, PlanKey } from '@/config/subscriptionPlans';
import { MODEL_REGISTRY, isPaidModelPublicId } from '@/config/models-registry';

export interface CreditCalculationResult {
  creditsUsed: number;
  category: 'free' | 'paid';
  inputRate: number;
  outputRate: number;
}

export interface ModelEligibilityResult {
  allowed: boolean;
  code: 200 | 402 | 403 | 429;
  reason: string;
  category: 'free' | 'paid';
}

export interface ImageQuotaResult {
  canGenerate: boolean;
  dailyCount: number;
  dailyLimit: number; // -1 for unlimited
  remaining: number; // -1 for unlimited
  plan: PlanKey;
  message: string;
}

/**
 * Identify if a model is Free-tier or Paid-tier
 */
export function getModelCategory(modelIdOrApi: string): 'free' | 'paid' {
  const pid = String(modelIdOrApi || '').trim().toLowerCase();
  if (pid === 'auto' || !pid) return 'free';

  const reg = MODEL_REGISTRY.find(
    (m) =>
      m.publicId.toLowerCase() === pid ||
      m.name.toLowerCase() === pid ||
      m.providers?.some((p: any) => p.modelApi?.toLowerCase() === pid)
  );

  if (reg) {
    if (reg.accessTier === 'pro' || reg.accessTier === 'max' || reg.isPro) {
      return 'paid';
    }
    return 'free';
  }

  return isPaidModelPublicId(pid) ? 'paid' : 'free';
}

/**
 * Calculate credits required for a chat interaction
 * Formula:
 *   inputUnits  = ceil(promptTokens / 100)
 *   outputUnits = ceil(completionTokens / 100)
 *   creditsUsed = (inputUnits * inputRate) + (outputUnits * outputRate)
 */
export function calculateChatCredits(
  modelIdOrApi: string,
  promptTokens: number = 250,
  completionTokens: number = 350
): CreditCalculationResult {
  const category = getModelCategory(modelIdOrApi);

  // Rate constants from website
  // Free: input 1, output 2
  // Paid: input 5, output 7
  const inputRate = category === 'paid' ? 5 : 1;
  const outputRate = category === 'paid' ? 7 : 2;

  const inputUnits = Math.max(1, Math.ceil(promptTokens / 100));
  const outputUnits = Math.max(1, Math.ceil(completionTokens / 100));
  const creditsUsed = inputUnits * inputRate + outputUnits * outputRate;

  // Minimum floor
  const floor = category === 'paid' ? 10 : 2;

  return {
    creditsUsed: Math.max(floor, creditsUsed),
    category,
    inputRate,
    outputRate,
  };
}

/**
 * Pre-flight check: Can the user invoke this model given their plan and wallet balances?
 */
export function checkModelEligibility(
  userProfile: UserProfile | null | undefined,
  model: {
    modelApi?: string;
    publicId?: string;
    accessTier?: string;
    isPro?: boolean;
  }
): ModelEligibilityResult {
  const modelKey = model.modelApi || model.publicId || 'auto';
  const category = getModelCategory(modelKey);
  const plan = normalizePlan(userProfile?.plan);
  const userEmail = userProfile?.email || '';

  // Owner permanent account bypass
  if (userEmail.toLowerCase() === 'arpitariyanm@gmail.com') {
    return { allowed: true, code: 200, reason: 'ok', category };
  }

  const freeCredits = Math.max(0, Number(userProfile?.credits ?? 0));
  const paidCredits = Math.max(0, Number(userProfile?.paid_credits ?? 0));

  // Check model tier accessibility rule
  const accessible = canAccessModel(model, plan, paidCredits, userEmail);
  if (!accessible) {
    return {
      allowed: false,
      code: 403,
      reason: 'This model is exclusively available on Pro and Max plans. Please upgrade to unlock.',
      category,
    };
  }

  // Free model deduction check
  if (category === 'free') {
    if (freeCredits <= 0 && paidCredits <= 0) {
      return {
        allowed: false,
        code: 429,
        reason: 'Your daily free credits (5,000/day) are exhausted. They reset at midnight UTC.',
        category: 'free',
      };
    }
    return { allowed: true, code: 200, reason: 'ok', category: 'free' };
  }

  // Paid model deduction check
  if (category === 'paid') {
    if (plan === 'free' && paidCredits <= 0) {
      return {
        allowed: false,
        code: 403,
        reason: 'Paid models require a Pro or Max subscription with paid credits. Please upgrade your plan.',
        category: 'paid',
      };
    }

    if (paidCredits <= 0) {
      return {
        allowed: false,
        code: 402,
        reason: 'Your monthly paid credits are exhausted. Upgrade to Max or recharge API credits to continue.',
        category: 'paid',
      };
    }

    return { allowed: true, code: 200, reason: 'ok', category: 'paid' };
  }

  return { allowed: true, code: 200, reason: 'ok', category };
}

/**
 * On-the-fly daily reset helper
 * If last_daily_reset !== today, refreshes daily free credits to 5,000.
 */
export async function applyOnTheFlyDailyReset(
  userDoc: UserProfile
): Promise<{ user: UserProfile; didReset: boolean }> {
  if (!userDoc || !userDoc.$id) {
    return { user: userDoc, didReset: false };
  }

  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  if (userDoc.last_daily_reset === today) {
    return { user: userDoc, didReset: false };
  }

  if (userDoc.$id.startsWith('local_') || userDoc.$id.startsWith('fallback_') || userDoc.$id.startsWith('temp_')) {
    return {
      user: {
        ...userDoc,
        credits: 5000,
        last_daily_reset: today,
      },
      didReset: true,
    };
  }

  try {
    const updated = await databases.updateDocument(DB_ID, USERS_COLLECTION_ID, userDoc.$id, {
      credits: 5000,
      last_daily_reset: today,
    });
    return { user: updated as unknown as UserProfile, didReset: true };
  } catch (err: any) {
    console.warn('[creditEngine] Daily reset update non-fatal:', err?.message || err);
    return {
      user: {
        ...userDoc,
        credits: 5000,
        last_daily_reset: today,
      },
      didReset: true,
    };
  }
}

/**
 * Deduct credits from the proper wallet after successful generation
 */
export async function deductUsageCredits(params: {
  userProfile: UserProfile;
  modelIdOrApi: string;
  creditsToDeduct: number;
  metadata?: Record<string, any>;
}): Promise<{
  updatedUser: UserProfile;
  walletDeducted: 'credits' | 'paid_credits';
  newBalance: number;
}> {
  const { userProfile, modelIdOrApi, creditsToDeduct, metadata } = params;
  const category = getModelCategory(modelIdOrApi);

  // If user is permanent owner, skip deduction
  if (userProfile.email?.toLowerCase() === 'arpitariyanm@gmail.com') {
    return {
      updatedUser: userProfile,
      walletDeducted: category === 'paid' ? 'paid_credits' : 'credits',
      newBalance: 999999,
    };
  }

  // Dual-wallet routing:
  // Paid models deduct from paid_credits
  // Free models deduct from credits first (or paid_credits if credits === 0)
  let walletField: 'credits' | 'paid_credits' = 'credits';

  if (category === 'paid') {
    walletField = 'paid_credits';
  } else {
    // If daily free credits are exhausted, draw from paid_credits if available
    if ((userProfile.credits ?? 0) <= 0 && (userProfile.paid_credits ?? 0) > 0) {
      walletField = 'paid_credits';
    } else {
      walletField = 'credits';
    }
  }

  const currentWalletVal = Math.max(0, Number(userProfile[walletField] ?? 0));
  const newWalletVal = Math.max(0, currentWalletVal - creditsToDeduct);

  const updatedUser: UserProfile = {
    ...userProfile,
    [walletField]: newWalletVal,
  };

  // Persist to Appwrite users collection if real doc
  if (userProfile.$id && !userProfile.$id.startsWith('local_') && !userProfile.$id.startsWith('fallback_')) {
    try {
      await databases.updateDocument(DB_ID, USERS_COLLECTION_ID, userProfile.$id, {
        [walletField]: newWalletVal,
      });

      // Asynchronously record usage log if USAGE_LOGS_COLLECTION_ID exists
      if (USAGE_LOGS_COLLECTION_ID) {
        databases
          .createDocument(DB_ID, USAGE_LOGS_COLLECTION_ID, 'unique()', {
            user_id: userProfile.$id,
            user_email: userProfile.email,
            operation_type: 'chat',
            model: modelIdOrApi,
            wallet_type: walletField,
            credits_used: creditsToDeduct,
            wallet_balance_after: newWalletVal,
            created_at: new Date().toISOString(),
            ...metadata,
          })
          .catch(() => {});
      }
    } catch (err: any) {
      console.warn('[creditEngine] Deduct persistence non-fatal:', err?.message || err);
    }
  }

  return {
    updatedUser,
    walletDeducted: walletField,
    newBalance: newWalletVal,
  };
}

/**
 * Check daily image generation quota for a user
 * Free Plan: 10 images per day
 * Pro / Max Plan: Unlimited (-1)
 */
export async function checkDailyImageQuota(
  userProfile: UserProfile | null | undefined
): Promise<ImageQuotaResult> {
  const plan = normalizePlan(userProfile?.plan);
  const email = userProfile?.email?.trim().toLowerCase();

  // Owner permanent account
  if (email === 'arpitariyanm@gmail.com') {
    return {
      canGenerate: true,
      dailyCount: 0,
      dailyLimit: -1,
      remaining: -1,
      plan: 'pro',
      message: 'Unlimited image generation available (Special Account)',
    };
  }

  // Pro and Max have unlimited image generation
  if (plan === 'pro' || plan === 'max') {
    return {
      canGenerate: true,
      dailyCount: 0,
      dailyLimit: -1,
      remaining: -1,
      plan,
      message: `Unlimited image generation available with ${plan === 'max' ? 'Max' : 'Pro'} Plan`,
    };
  }

  // Free Plan: Check today's completed/generating images
  const freeLimit = 10;

  if (!email || !DB_ID || !IMAGE_GENERATION_COLLECTION_ID) {
    return {
      canGenerate: true,
      dailyCount: 0,
      dailyLimit: freeLimit,
      remaining: freeLimit,
      plan: 'free',
      message: `${freeLimit} images remaining today (Free plan)`,
    };
  }

  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const res = await databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
      Query.equal('userEmail', email),
      Query.greaterThanEqual('$createdAt', startOfDay.toISOString()),
      Query.lessThanEqual('$createdAt', endOfDay.toISOString()),
      Query.limit(20),
    ]);

    const count = res.total || res.documents.length || 0;
    const canGenerate = count < freeLimit;
    const remaining = Math.max(0, freeLimit - count);

    return {
      canGenerate,
      dailyCount: count,
      dailyLimit: freeLimit,
      remaining,
      plan: 'free',
      message: canGenerate
        ? `${remaining} of ${freeLimit} images remaining today (Free plan)`
        : `Daily limit of ${freeLimit} images reached. Upgrade to Pro for unlimited generation.`,
    };
  } catch (err: any) {
    console.warn('[creditEngine] checkDailyImageQuota query fallback:', err?.message || err);
    return {
      canGenerate: true,
      dailyCount: 0,
      dailyLimit: freeLimit,
      remaining: freeLimit,
      plan: 'free',
      message: `${freeLimit} images remaining today (Free plan)`,
    };
  }
}
