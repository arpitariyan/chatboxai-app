/**
 * src/config/subscriptionPlans.ts
 *
 * ChatBox AI — Subscription Plans & Plan Entitlements
 * Exact 1:1 parity with ChatboxAI website version (lib/subscriptionPlans.js & lib/modelAccess.js).
 */

export type PlanKey = 'free' | 'pro' | 'max';

export interface PlanConfig {
  key: PlanKey;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  dailyCredits: number;
  paidCredits: number;
  dailyImageLimit: number; // -1 = unlimited
  researchLimit: number; // weekly limit
  tokenUsageFactor: number;
  maxCostTier: number;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<PlanKey, PlanConfig> = {
  free: {
    key: 'free',
    displayName: 'Free Plan',
    monthlyPrice: 0,
    annualPrice: 0,
    dailyCredits: 5000,
    paidCredits: 0,
    dailyImageLimit: 10,
    researchLimit: 5,
    tokenUsageFactor: 1,
    maxCostTier: 2,
    features: [
      '5,000 Daily Credits for Free Models',
      'Access to Free-tier models (Llama 3, Gemini Flash-Lite, etc.)',
      '10 AI Images per day',
      '5 Deep Research reports per week',
      'Free credits reset daily at midnight UTC',
      'Standard support',
    ],
  },
  pro: {
    key: 'pro',
    displayName: 'Pro Plan',
    monthlyPrice: 499,
    annualPrice: 4990,
    dailyCredits: 5000,
    paidCredits: 30000,
    dailyImageLimit: -1, // Unlimited
    researchLimit: 15,
    tokenUsageFactor: 0.5,
    maxCostTier: 5,
    features: [
      '30,000 Paid Credits Monthly',
      '5,000 Daily Free Credits (bonus)',
      'Access to ALL models (Claude 3.7, GPT-5, etc.)',
      'Unlimited AI Image Generation',
      '15 Deep Research reports per week',
      'Seamless fallback to Free models if paid balance finishes',
      'Paid credits recharge monthly on your billing date',
    ],
  },
  max: {
    key: 'max',
    displayName: 'Max Plan',
    monthlyPrice: 1999,
    annualPrice: 19990,
    dailyCredits: 5000,
    paidCredits: 150000,
    dailyImageLimit: -1, // Unlimited
    researchLimit: 25,
    tokenUsageFactor: 1,
    maxCostTier: 5,
    features: [
      '150,000 Paid Credits Monthly',
      '5,000 Daily Free Credits (bonus)',
      'Access to ALL frontier models (Claude Opus 4.7, GPT-5.6 Sol)',
      'Unlimited AI Image Generation with maximum priority',
      '25 Deep Research reports per week',
      'Highest concurrency & zero rate-limiting',
      'Priority VIP developer support',
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ['free', 'pro', 'max'];

export function normalizePlan(plan?: string | null): PlanKey {
  const normalized = String(plan || 'free').toLowerCase().trim();
  if (normalized === 'pro') return 'pro';
  if (normalized === 'max') return 'max';
  return 'free';
}

export function getPlanConfig(plan?: string | null): PlanConfig {
  return SUBSCRIPTION_PLANS[normalizePlan(plan)];
}

export function getPlanDisplayName(plan?: string | null): string {
  return getPlanConfig(plan).displayName;
}

export function getPlanDailyCredits(plan?: string | null): number {
  return getPlanConfig(plan).dailyCredits;
}

export function getPlanPaidCredits(plan?: string | null): number {
  return getPlanConfig(plan).paidCredits;
}

export function getPlanDailyImageLimit(plan?: string | null): number {
  return getPlanConfig(plan).dailyImageLimit;
}

export function getPlanResearchLimit(plan?: string | null): number {
  return getPlanConfig(plan).researchLimit;
}

export function isPaidPlan(plan?: string | null): boolean {
  return normalizePlan(plan) !== 'free';
}

export function isMaxPlan(plan?: string | null): boolean {
  return normalizePlan(plan) === 'max';
}

/**
 * Check if a user can access a specific model.
 * Direct parity with website `canAccessModel` in `lib/modelAccess.js` & `services/Shared.jsx`:
 *
 * Rules:
 *  - 'arpitariyanm@gmail.com' permanent owner account -> always true
 *  - Auto model -> always true
 *  - Any user with paid_credits > 0 -> always true (paid balance unlocks paid models)
 *  - Pro and Max plan -> true (unless user has paid_credits <= 0 and model is strictly paid)
 *  - Free plan without paid credits -> ONLY accessTier === 'free' and !model.isPro
 */
export function canAccessModel(
  model: {
    accessTier?: string;
    isPro?: boolean;
    modelApi?: string;
    publicId?: string;
  } | null | undefined,
  userPlan: string = 'free',
  paidCredits: number | null | undefined = null,
  userEmail?: string | null
): boolean {
  if (!model) return true;

  // Auto model is always accessible
  const apiId = String(model.modelApi || model.publicId || '').toLowerCase();
  if (apiId === 'auto' || !apiId) return true;

  // Permanent admin/owner account
  if (userEmail && String(userEmail).toLowerCase() === 'arpitariyanm@gmail.com') {
    return true;
  }

  // If user has available paid credits, all models are unlocked
  if (paidCredits !== null && paidCredits !== undefined && Number(paidCredits) > 0) {
    return true;
  }

  const plan = normalizePlan(userPlan);

  // Free Plan users: strictly restricted to free tier
  if (plan === 'free') {
    const accessTier = model.accessTier?.toLowerCase();
    if (accessTier) {
      return accessTier === 'free';
    }
    return !model.isPro;
  }

  // Pro or Max users:
  // If paidCredits is explicitly passed as 0, paid models are locked until next monthly renewal
  if (paidCredits !== null && paidCredits !== undefined && Number(paidCredits) <= 0) {
    const accessTier = model.accessTier?.toLowerCase();
    const isPaidModel = accessTier ? accessTier !== 'free' : Boolean(model.isPro);
    if (isPaidModel) return false;
  }

  return true;
}
