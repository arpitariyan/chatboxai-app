import { databases, DB_ID, Query, ID } from './appwrite-admin';
import {
  USERS_COLLECTION_ID,
  SUBSCRIPTIONS_COLLECTION_ID,
  USAGE_LOGS_COLLECTION_ID,
} from './appwrite-admin';
import { logger } from './logger';

export const RESEARCH_LIMITS = {
  free: 5,
  pro: 15,
  max: 25,
} as const;

export type PlanType = 'free' | 'pro' | 'max';

export interface ResearchQuotaStatus {
  canResearch: boolean;
  weeklyCount: number;
  weeklyLimit: number;
  remaining: number;
  plan: PlanType;
  resetsAt: string;
  message: string;
}

export interface UserPlanInfo {
  isPro: boolean;
  isMax: boolean;
  plan: PlanType;
  subscription: any | null;
  isExpired: boolean;
  expiresAt: string | null;
  credits: number;
  paid_credits: number;
}

// ── In-memory user cache (30s TTL) to prevent hammering Appwrite ─────────────
const userCache = new Map<string, { ts: number; data: any }>();
const USER_CACHE_TTL_MS = 30_000;

function getCachedUser(email: string) {
  const entry = userCache.get(email.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.ts > USER_CACHE_TTL_MS) {
    userCache.delete(email.toLowerCase());
    return null;
  }
  return entry.data;
}

function setCachedUser(email: string, data: any) {
  userCache.set(email.toLowerCase(), { ts: Date.now(), data });
}

// ── Promise Timeout Wrapper ──────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms = 5000, label = 'Appwrite'): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Calculates current UTC week window (Sunday 00:00:00 UTC to next Sunday 00:00:00 UTC - 1ms).
 */
export function getWeekWindowUtc(date = new Date()) {
  const now = new Date(date);
  const day = now.getUTCDay(); // 0 = Sunday
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - day,
      0,
      0,
      0,
      0
    )
  );

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);

  return { start, end };
}

/**
 * Normalizes plan string into 'free' | 'pro' | 'max'
 */
export function normalizePlan(plan?: string | null): PlanType {
  const p = String(plan || 'free').toLowerCase();
  if (p === 'pro') return 'pro';
  if (p === 'max') return 'max';
  return 'free';
}

/**
 * Inspects user plan and active subscriptions from Appwrite
 */
export async function checkUserPlan(userEmail: string): Promise<UserPlanInfo> {
  const email = (userEmail || '').trim().toLowerCase();
  if (!email) {
    return {
      isPro: false,
      isMax: false,
      plan: 'free',
      subscription: null,
      isExpired: false,
      expiresAt: null,
      credits: 0,
      paid_credits: 0,
    };
  }

  // Owner permanent bypass
  if (email === 'arpitariyanm@gmail.com') {
    return {
      isPro: true,
      isMax: true,
      plan: 'max',
      subscription: null,
      isExpired: false,
      expiresAt: null,
      credits: 999999,
      paid_credits: 999999,
    };
  }

  try {
    let user = getCachedUser(email);
    if (!user) {
      const usersRes = await withTimeout(
        databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
          Query.equal('email', email),
          Query.limit(1),
        ]),
        5000,
        'checkUserPlan'
      );
      user = usersRes.documents[0] || null;
      if (user) setCachedUser(email, user);
    }

    if (!user) {
      return {
        isPro: false,
        isMax: false,
        plan: 'free',
        subscription: null,
        isExpired: false,
        expiresAt: null,
        credits: 0,
        paid_credits: 0,
      };
    }

    const credits = user.credits ?? 0;
    const paid_credits = user.paid_credits ?? 0;
    let normalizedPlan = normalizePlan(user.plan);

    // Check expiration if user has subscription_end_date
    if (normalizedPlan !== 'free' && user.subscription_end_date) {
      const now = new Date();
      const expiryDate = new Date(user.subscription_end_date);
      if (expiryDate <= now) {
        return {
          isPro: false,
          isMax: false,
          plan: 'free',
          subscription: null,
          isExpired: true,
          expiresAt: user.subscription_end_date,
          credits,
          paid_credits,
        };
      }

      return {
        isPro: true,
        isMax: normalizedPlan === 'max',
        plan: normalizedPlan,
        subscription: {
          start_date: user.subscription_start_date,
          end_date: user.subscription_end_date,
        },
        isExpired: false,
        expiresAt: user.subscription_end_date,
        credits,
        paid_credits,
      };
    }

    // Check active subscriptions collection
    try {
      const subRes = await withTimeout(
        databases.listDocuments(DB_ID, SUBSCRIPTIONS_COLLECTION_ID, [
          Query.equal('user_email', email),
          Query.equal('status', 'active'),
          Query.orderDesc('created_at'),
          Query.limit(1),
        ]),
        4000,
        'subscriptions'
      );
      const subscription = subRes.documents[0] || null;
      if (subscription && subscription.status === 'active') {
        const subPlan = normalizePlan(subscription.plan_type || user.plan || 'pro');
        return {
          isPro: true,
          isMax: subPlan === 'max',
          plan: subPlan,
          subscription,
          isExpired: false,
          expiresAt: user.subscription_end_date,
          credits,
          paid_credits,
        };
      }
    } catch (_) {
      // Subscriptions collection query non-blocking fallback
    }

    return {
      isPro: normalizedPlan !== 'free',
      isMax: normalizedPlan === 'max',
      plan: normalizedPlan,
      subscription: null,
      isExpired: false,
      expiresAt: user.subscription_end_date || null,
      credits,
      paid_credits,
    };
  } catch (error: any) {
    logger.warn('Error checking user plan in quota-manager:', { email, error: error.message });
    return {
      isPro: false,
      isMax: false,
      plan: 'free',
      subscription: null,
      isExpired: false,
      expiresAt: null,
      credits: 0,
      paid_credits: 0,
    };
  }
}

/**
 * Counts research usage records for this user in the current weekly window.
 */
export async function getWeeklyResearchCount(userEmail: string, userId?: string): Promise<number> {
  const email = (userEmail || '').trim().toLowerCase();
  if (!email && !userId) return 0;

  try {
    const { start: startOfWeek, end: endOfWeek } = getWeekWindowUtc();
    const baseFilters = [
      Query.equal('operation_type', 'research'),
      Query.greaterThanEqual('$createdAt', startOfWeek.toISOString()),
      Query.lessThanEqual('$createdAt', endOfWeek.toISOString()),
    ];

    // Try by userId if provided or found
    let effectiveUserId = userId;
    if (!effectiveUserId && email) {
      const user = getCachedUser(email);
      if (user?.$id) effectiveUserId = user.$id;
    }

    if (effectiveUserId) {
      try {
        const byUserId = await withTimeout(
          databases.listDocuments(DB_ID, USAGE_LOGS_COLLECTION_ID, [
            Query.equal('user_id', effectiveUserId),
            ...baseFilters,
          ]),
          4000,
          'getWeeklyResearchCountByUserId'
        );
        return byUserId.total || 0;
      } catch (err: any) {
        if (!String(err?.message || '').includes('Attribute not found')) {
          logger.warn('Failed to query usage by user_id:', { error: err.message });
        }
      }
    }

    if (email) {
      const byUserEmail = await withTimeout(
        databases.listDocuments(DB_ID, USAGE_LOGS_COLLECTION_ID, [
          Query.equal('user_email', email),
          ...baseFilters,
        ]),
        4000,
        'getWeeklyResearchCountByUserEmail'
      );
      return byUserEmail.total || 0;
    }

    return 0;
  } catch (error: any) {
    logger.warn('Error counting weekly research usage:', { email, userId, error: error.message });
    return 0;
  }
}

export function calculateQuotaForPlan(
  plan: PlanType,
  weeklyCount: number,
  resetsAt: Date | string
): ResearchQuotaStatus {
  const resetsAtStr = typeof resetsAt === 'string' ? resetsAt : resetsAt.toISOString();
  const weeklyLimit = RESEARCH_LIMITS[plan] ?? RESEARCH_LIMITS.free;
  const canResearch = weeklyCount < weeklyLimit;
  const remaining = Math.max(0, weeklyLimit - weeklyCount);

  const message = canResearch
    ? `${remaining} Deep Research uses remaining this week (${plan.toUpperCase()} plan)`
    : `Weekly limit of ${weeklyLimit} Deep Research uses reached for ${plan.toUpperCase()} plan. Resets on Sunday.`;

  return {
    canResearch,
    weeklyCount,
    weeklyLimit,
    remaining,
    plan,
    resetsAt: resetsAtStr,
    message,
  };
}

/**
 * Complete check of user Deep Research allowance and remaining weekly balance.
 */
export async function checkResearchLimit(userEmail: string, userId?: string): Promise<ResearchQuotaStatus> {
  const email = (userEmail || '').trim().toLowerCase();
  const { end: endOfWeek } = getWeekWindowUtc();
  const resetsAt = endOfWeek.toISOString();

  // Owner account has unlimited access
  if (email === 'arpitariyanm@gmail.com') {
    const weeklyCount = await getWeeklyResearchCount(email, userId);
    return {
      canResearch: true,
      weeklyCount,
      weeklyLimit: -1,
      remaining: -1,
      plan: 'max',
      resetsAt,
      message: 'Unlimited Deep Research available (Special Account)',
    };
  }

  if (!email && !userId) {
    return {
      canResearch: false,
      weeklyCount: 0,
      weeklyLimit: RESEARCH_LIMITS.free,
      remaining: 0,
      plan: 'free',
      resetsAt,
      message: 'Authentication is required to use Deep Research.',
    };
  }

  const [planInfo, weeklyCount] = await Promise.all([
    checkUserPlan(email),
    getWeeklyResearchCount(email, userId),
  ]);

  return calculateQuotaForPlan(planInfo.plan, weeklyCount, resetsAt);
}

/**
 * Records a successful Deep Research execution into Appwrite usage_logs
 */
export async function logResearchUsage(userEmail: string, userId?: string): Promise<void> {
  const email = (userEmail || '').trim().toLowerCase();
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      const user = getCachedUser(email);
      if (user?.$id) resolvedUserId = user.$id;
    }

    if (resolvedUserId) {
      try {
        await databases.createDocument(DB_ID, USAGE_LOGS_COLLECTION_ID, ID.unique(), {
          user_id: resolvedUserId,
          user_email: email || undefined,
          model: 'research',
          operation_type: 'research',
          credits_consumed: 0,
          credits_remaining: 0,
        });
        logger.info('Logged research usage by user_id:', { userId: resolvedUserId });
        return;
      } catch (err: any) {
        logger.warn('Failed logging usage by user_id, falling back to email:', { error: err.message });
      }
    }

    if (email) {
      await databases.createDocument(DB_ID, USAGE_LOGS_COLLECTION_ID, ID.unique(), {
        user_email: email,
        model: 'research',
        operation_type: 'research',
        credits_consumed: 0,
        credits_remaining: 0,
      });
      logger.info('Logged research usage by user_email:', { email });
    }
  } catch (error: any) {
    logger.error('Failed to log research usage to Appwrite:', { email, userId, error: error.message });
  }
}
