/**
 * src/services/researchService.ts
 *
 * Client-side service for Deep Research:
 * - Weekly quota and usage status check (Backend API with direct Appwrite and AsyncStorage fallbacks)
 * - Deep Research pipeline execution via Mobile Backend
 * - Offline-first design: Never raises intrusive LogBox console warnings on network disruption
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { toMobileResearchUsageUrl, toMobileResearchExecuteUrl } from '../config/mobileApi';
import {
  databases,
  DB_ID,
  USERS_COLLECTION_ID,
  USAGE_LOGS_COLLECTION_ID,
  Query,
} from '../config/appwrite';

const QUOTA_STORAGE_KEY = '@chatboxai:research_quota_cache';

export interface ResearchQuotaStatus {
  canResearch: boolean;
  weeklyCount: number;
  weeklyLimit: number;
  remaining: number;
  plan: 'free' | 'pro' | 'max';
  resetsAt: string;
  message: string;
}

export interface ResearchSourceItem {
  id: number;
  title: string;
  url: string;
  description: string;
  content?: string;
  displayLink?: string;
  qualityScore?: number;
  qualityBand?: 'high' | 'medium' | 'low';
  sourceHost?: string;
  deepResearch?: boolean;
}

export interface ResearchExecutionResponse {
  success: boolean;
  aiResponse: string;
  thinkingContent: string;
  confidence: 'High' | 'Medium' | 'Low' | 'Not Assessed';
  sources: ResearchSourceItem[];
  searchResult: ResearchSourceItem[];
  metadata?: {
    queriesExecuted?: string[];
    totalSourcesFound?: number;
    uniqueSources?: number;
    durationsMs?: Record<string, number>;
  };
}

/**
 * Calculates current UTC week window (Sunday 00:00:00 UTC to next Sunday 00:00:00 UTC - 1ms).
 */
export function getClientWeekWindowUtc(date = new Date()) {
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
 * Direct client-side Appwrite fallback query to calculate weekly quota
 * when the Express server is offline, updating, or unreachable.
 */
async function fetchQuotaFromAppwriteDirect(email?: string): Promise<ResearchQuotaStatus | null> {
  const normalizedEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  const { end: endOfWeek, start: startOfWeek } = getClientWeekWindowUtc();
  const resetsAt = endOfWeek.toISOString();

  // Owner permanent bypass
  if (normalizedEmail === 'arpitariyanm@gmail.com') {
    return {
      canResearch: true,
      weeklyCount: 0,
      weeklyLimit: -1,
      remaining: -1,
      plan: 'max',
      resetsAt,
      message: 'Unlimited Deep Research available (Special Account)',
    };
  }

  if (!normalizedEmail) {
    return {
      canResearch: true, // Guest allowance
      weeklyCount: 0,
      weeklyLimit: 5,
      remaining: 5,
      plan: 'free',
      resetsAt,
      message: 'Free Plan (5 uses per week)',
    };
  }

  try {
    // 1. Resolve user plan
    let plan: 'free' | 'pro' | 'max' = 'free';
    try {
      const userRes = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
        Query.equal('email', normalizedEmail),
        Query.limit(1),
      ]);
      if (userRes.documents.length > 0) {
        const u = userRes.documents[0];
        const p = String(u.plan || 'free').toLowerCase();
        if (p === 'pro') plan = 'pro';
        else if (p === 'max') plan = 'max';
      }
    } catch {
      // Non-fatal, assume free
    }

    // 2. Count research usage logs this week
    let weeklyCount = 0;
    try {
      const usageRes = await databases.listDocuments(DB_ID, USAGE_LOGS_COLLECTION_ID, [
        Query.equal('user_email', normalizedEmail),
        Query.equal('operation_type', 'research'),
        Query.greaterThanEqual('$createdAt', startOfWeek.toISOString()),
        Query.lessThanEqual('$createdAt', endOfWeek.toISOString()),
      ]);
      weeklyCount = usageRes.total || 0;
    } catch {
      // Non-fatal
    }

    const limits = { free: 5, pro: 15, max: 25 };
    const weeklyLimit = limits[plan] ?? 5;
    const canResearch = weeklyCount < weeklyLimit;
    const remaining = Math.max(0, weeklyLimit - weeklyCount);

    return {
      canResearch,
      weeklyCount,
      weeklyLimit,
      remaining,
      plan,
      resetsAt,
      message: canResearch
        ? `${remaining} Deep Research uses remaining this week (${plan.toUpperCase()} plan)`
        : `Weekly limit of ${weeklyLimit} reached for ${plan.toUpperCase()} plan. Resets on Sunday.`,
    };
  } catch {
    return null;
  }
}

let isBackendQuotaEndpointSupported = true;
let lastBackendProbeTime = 0;

export const researchService = {
  /**
   * Fetches weekly usage quota and limit status for the current user.
   * Multi-tiered fallback architecture:
   * 1. Primary: Mobile Backend API (/api/mobile/research/usage)
   * 2. Secondary: Direct Appwrite Database query (if backend is offline/updating)
   * 3. Tertiary: Local AsyncStorage cached quota
   * 4. Default: Safe 5 free uses
   */
  async getQuota(userEmail?: string): Promise<ResearchQuotaStatus> {
    const { end: endOfWeek } = getClientWeekWindowUtc();
    const defaultResetsAt = endOfWeek.toISOString();

    const fallbackDefault: ResearchQuotaStatus = {
      canResearch: true,
      weeklyCount: 0,
      weeklyLimit: 5,
      remaining: 5,
      plan: 'free',
      resetsAt: defaultResetsAt,
      message: 'Free Plan (5 uses per week)',
    };

    // 1. Try Primary Backend API (only if not recently flagged as 404 unsupported)
    const shouldProbeBackend =
      isBackendQuotaEndpointSupported || Date.now() - lastBackendProbeTime > 10 * 60 * 1000;

    if (shouldProbeBackend) {
      try {
        const token = await auth.currentUser?.getIdToken();
        const url = toMobileResearchUsageUrl(userEmail);

        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await axios.get(url, { headers, timeout: 4000 });
        if (res.data && typeof res.data.canResearch === 'boolean') {
          isBackendQuotaEndpointSupported = true;
          // Cache successful response in AsyncStorage
          AsyncStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(res.data)).catch(() => {});
          return res.data;
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Flag route as not deployed yet on remote server to avoid repeated failed calls
          isBackendQuotaEndpointSupported = false;
          lastBackendProbeTime = Date.now();
        }
      }
    }

    // 2. Try Secondary: Direct Appwrite Query
    try {
      const appwriteQuota = await fetchQuotaFromAppwriteDirect(userEmail);
      if (appwriteQuota) {
        AsyncStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(appwriteQuota)).catch(() => {});
        return appwriteQuota;
      }
    } catch {
      // Continue to local cache
    }

    // 3. Try Tertiary: Local AsyncStorage Cache
    try {
      const cached = await AsyncStorage.getItem(QUOTA_STORAGE_KEY);
      if (cached) {
        const parsed: ResearchQuotaStatus = JSON.parse(cached);
        const resetTime = new Date(parsed.resetsAt).getTime();
        // Check if cached quota is still valid for this current week
        if (!Number.isNaN(resetTime) && resetTime > Date.now()) {
          return parsed;
        }
      }
    } catch {
      // Non-fatal
    }

    // 4. Default clean fallback
    return fallbackDefault;
  },

  /**
   * Dispatches full multi-provider Deep Research pipeline to backend.
   */
  async executeResearch(params: {
    searchInput: string;
    selectedModel?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    userEmail?: string;
  }): Promise<ResearchExecutionResponse> {
    const token = await auth.currentUser?.getIdToken();
    const url = toMobileResearchExecuteUrl();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await axios.post(url, params, {
        headers,
        timeout: 120000, // 2 minutes for deep multi-query crawling & reasoning
      });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404) {
        throw new Error('Deep Research server endpoint is currently deploying. Please try again in a few moments.');
      }
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        throw new Error('Unable to connect to the research server. Please verify your connection or try again shortly.');
      }
      throw err;
    }
  },
};
