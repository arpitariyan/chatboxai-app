/**
 * src/stores/useResearchStore.ts
 *
 * Global state store for Deep Research mode, weekly quota, and limit modals.
 * Features in-flight deduplication and intelligent memory caching (5-minute TTL).
 */

import { create } from 'zustand';
import { researchService, ResearchQuotaStatus } from '../services/researchService';
import { useModelStore } from './useModelStore';

const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ResearchStoreState {
  isResearchMode: boolean;
  quota: ResearchQuotaStatus | null;
  lastFetchedAt: number;
  lastFetchedEmail: string | null;
  isCheckingQuota: boolean;
  isLimitSheetVisible: boolean;
  setResearchMode: (enabled: boolean) => void;
  openLimitSheet: () => void;
  closeLimitSheet: () => void;
  fetchQuota: (userEmail?: string, forceRefresh?: boolean) => Promise<ResearchQuotaStatus | null>;
  toggleResearchMode: (userEmail?: string) => Promise<boolean>;
}

let inFlightPromise: Promise<ResearchQuotaStatus | null> | null = null;

export const useResearchStore = create<ResearchStoreState>((set, get) => ({
  isResearchMode: false,
  quota: null,
  lastFetchedAt: 0,
  lastFetchedEmail: null,
  isCheckingQuota: false,
  isLimitSheetVisible: false,

  setResearchMode: (enabled: boolean) => {
    set({ isResearchMode: enabled });
    useModelStore.getState().syncModelWithMode(enabled);
  },

  openLimitSheet: () => set({ isLimitSheetVisible: true }),
  closeLimitSheet: () => set({ isLimitSheetVisible: false }),

  fetchQuota: async (userEmail?: string, forceRefresh = false) => {
    const { quota, lastFetchedAt, lastFetchedEmail } = get();
    const normalizedEmail = (userEmail || '').trim().toLowerCase();

    // 1. If we already have a valid in-memory quota within TTL for this user, reuse it!
    if (
      !forceRefresh &&
      quota &&
      normalizedEmail === (lastFetchedEmail || '') &&
      Date.now() - lastFetchedAt < QUOTA_CACHE_TTL_MS
    ) {
      return quota;
    }

    // 2. If a fetch is already in flight for this user, return the same promise to deduplicate
    if (inFlightPromise) {
      return inFlightPromise;
    }

    set({ isCheckingQuota: true });

    inFlightPromise = (async () => {
      try {
        const q = await researchService.getQuota(userEmail);
        set({
          quota: q,
          lastFetchedAt: Date.now(),
          lastFetchedEmail: normalizedEmail,
          isCheckingQuota: false,
        });
        return q;
      } catch (e) {
        set({ isCheckingQuota: false });
        return get().quota;
      } finally {
        inFlightPromise = null;
      }
    })();

    return inFlightPromise;
  },

  toggleResearchMode: async (userEmail?: string) => {
    const { isResearchMode, quota, fetchQuota, openLimitSheet, setResearchMode } = get();

    // If currently ON, toggling simply turns it OFF
    if (isResearchMode) {
      setResearchMode(false);
      return false;
    }

    // Toggling ON: check or re-fetch quota first
    let currentQuota = quota;
    if (!currentQuota) {
      currentQuota = await fetchQuota(userEmail);
    }

    if (currentQuota && !currentQuota.canResearch) {
      // Limit reached: open bottom sheet and stay in regular mode
      openLimitSheet();
      setResearchMode(false);
      return false;
    }

    // Quota permitted: activate Deep Research mode and sync models
    setResearchMode(true);
    return true;
  },
}));
