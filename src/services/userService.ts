import { databases, DB_ID, USERS_COLLECTION_ID, Query, ID } from '@/config/appwrite';
import { auth } from '@/config/firebase';
import { apiClient } from './api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_CACHE_KEY_PREFIX = '@chatboxai:user_profile:';
const IN_MEMORY_PROFILE_CACHE = new Map<string, { profile: UserProfile; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds memory freshness

export interface UserProfile {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  email: string;
  name: string;
  plan: string;
  credits: number;
  paid_credits?: number;
  last_monthly_reset: string;
  last_daily_reset?: string;
  mfa_enabled: boolean;
  mfa_email?: string | null;
  accent_color: string;
  language: string;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  subscription_status?: string | null;
  is_blocked?: boolean;
  last_login?: string;
  is_manual_assignment?: boolean;
  team_id?: string | null;
  is_team_member?: boolean;
  created_at?: string;
  chat_font: string;
  memory_enabled: boolean;
  billing_date: number;
  signup_verified: boolean;
}

export function getUserNameFromEmail(email: string = ''): string {
  const emailName = String(email || '').split('@')[0] || 'user';
  const cleanName = emailName.replace(/[0-9._-]/g, '');
  const normalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
  return normalized || 'User';
}

export function buildDefaultUser(
  email: string,
  name?: string
): Omit<UserProfile, '$id' | '$createdAt' | '$updatedAt'> {
  const resolvedName = (name && name.trim()) || getUserNameFromEmail(email);
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  return {
    email,
    name: resolvedName,
    plan: 'free',
    credits: 5000,
    last_monthly_reset: today,
    mfa_enabled: false,
    mfa_email: null,
    accent_color: 'violet',
    language: 'en',
    chat_font: 'default',
    memory_enabled: true,
    billing_date: 1,
    signup_verified: true,
    created_at: now,
    last_login: now,
  };
}

/**
 * Fetch or auto-create user profile document from Appwrite Database `users` collection.
 */
export async function getCanonicalUserByEmail(
  email: string,
  displayName?: string,
  createIfMissing: boolean = true
): Promise<UserProfile> {
  if (!email) {
    throw new Error('Email is required to fetch user profile');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // 1. Instant in-memory cache return (< 1ms)
  const memCached = IN_MEMORY_PROFILE_CACHE.get(normalizedEmail);
  if (memCached && Date.now() - memCached.timestamp < CACHE_TTL_MS) {
    return memCached.profile;
  }

  // 2. Instant AsyncStorage local cache return (< 10ms)
  let localCachedProfile: UserProfile | null = null;
  try {
    const rawLocal = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY_PREFIX + normalizedEmail);
    if (rawLocal) {
      localCachedProfile = JSON.parse(rawLocal) as UserProfile;
      IN_MEMORY_PROFILE_CACHE.set(normalizedEmail, {
        profile: localCachedProfile,
        timestamp: Date.now(),
      });
    }
  } catch {
    // Non-fatal cache read error
  }

  // Helper to persist to caches
  const persistCache = (prof: UserProfile) => {
    IN_MEMORY_PROFILE_CACHE.set(normalizedEmail, {
      profile: prof,
      timestamp: Date.now(),
    });
    AsyncStorage.setItem(USER_PROFILE_CACHE_KEY_PREFIX + normalizedEmail, JSON.stringify(prof)).catch(() => {});
  };

  // 3. Network fetch function with aggressive timeout
  const fetchFromNetwork = async (): Promise<UserProfile> => {
    // 3a. Authenticated Mobile Backend Proxy Route (preferred, fastest)
    if (auth.currentUser) {
      try {
        const response = await apiClient.get('/api/mobile/user/profile', {
          timeout: 4000, // 4s fast timeout
        });
        if (response.data && response.data.email) {
          const prof = response.data as UserProfile;
          persistCache(prof);
          return prof;
        }
      } catch (err: any) {
        if (__DEV__) {
          console.debug('[userService] Mobile API profile fallback:', err?.message || err);
        }
      }
    }

    if (!DB_ID) {
      const def = buildDefaultUser(normalizedEmail, displayName) as unknown as UserProfile;
      persistCache(def);
      return def;
    }

    // 3b. Direct Appwrite fallback
    const response = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
      Query.equal('email', normalizedEmail),
      Query.limit(1),
    ]);

    if (response.documents && response.documents.length > 0) {
      let existingUser = response.documents[0] as unknown as UserProfile;
      const today = new Date().toISOString().split('T')[0];

      // Daily reset: 5000 free credits
      if (existingUser.last_daily_reset !== today && existingUser.$id) {
        try {
          const updated = await databases.updateDocument(
            DB_ID,
            USERS_COLLECTION_ID,
            existingUser.$id,
            {
              credits: 5000,
              last_daily_reset: today,
              last_login: new Date().toISOString(),
            }
          );
          existingUser = updated as unknown as UserProfile;
        } catch {
          existingUser = {
            ...existingUser,
            credits: 5000,
            last_daily_reset: today,
          };
        }
      } else if (existingUser.$id) {
        databases
          .updateDocument(DB_ID, USERS_COLLECTION_ID, existingUser.$id, {
            last_login: new Date().toISOString(),
          })
          .catch(() => {});
      }

      // Permanent developer/owner account tier enforcement
      if (normalizedEmail === 'arpitariyanm@gmail.com') {
        existingUser = {
          ...existingUser,
          plan: 'pro',
          credits: Math.max(5000, existingUser.credits ?? 5000),
          paid_credits: Math.max(1000, existingUser.paid_credits ?? 1000),
        };
      }

      persistCache(existingUser);
      return existingUser;
    }

    if (createIfMissing) {
      const payload = buildDefaultUser(normalizedEmail, displayName);
      try {
        const createdDoc = await databases.createDocument(
          DB_ID,
          USERS_COLLECTION_ID,
          ID.unique(),
          payload
        );
        const res = createdDoc as unknown as UserProfile;
        persistCache(res);
        return res;
      } catch {
        const fallback = {
          $id: 'fallback_' + Date.now(),
          ...payload,
        };
        persistCache(fallback);
        return fallback;
      }
    }

    const offlineDefault = {
      $id: 'temp_' + Date.now(),
      ...buildDefaultUser(normalizedEmail, displayName),
    };
    persistCache(offlineDefault);
    return offlineDefault;
  };

  // If local cached profile exists, return it IMMEDIATELY and refresh in background (Stale-While-Revalidate)
  if (localCachedProfile) {
    // Non-blocking background revalidation
    fetchFromNetwork().catch(() => {});
    return localCachedProfile;
  }

  // If no local cache exists, perform network fetch directly
  try {
    return await fetchFromNetwork();
  } catch {
    const fallback = {
      $id: 'local_' + Date.now(),
      ...buildDefaultUser(normalizedEmail, displayName),
    };
    persistCache(fallback);
    return fallback;
  }
}

/**
 * Update user preferences or profile fields with optimistic local cache update.
 */
export async function updateUserProfile(
  docId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  // Optimistically update memory and storage caches for instant 60fps UI feedback
  for (const [email, entry] of IN_MEMORY_PROFILE_CACHE.entries()) {
    if (entry.profile.$id === docId || !docId) {
      const updated = { ...entry.profile, ...updates };
      IN_MEMORY_PROFILE_CACHE.set(email, { profile: updated, timestamp: Date.now() });
      AsyncStorage.setItem(USER_PROFILE_CACHE_KEY_PREFIX + email, JSON.stringify(updated)).catch(() => {});
    }
  }

  if (!docId || docId.startsWith('local_') || docId.startsWith('fallback_') || docId.startsWith('temp_')) {
    return null;
  }

  try {
    const updated = await databases.updateDocument(
      DB_ID,
      USERS_COLLECTION_ID,
      docId,
      updates
    );
    return updated as unknown as UserProfile;
  } catch (error: any) {
    console.warn('[Appwrite] Non-fatal error updating user profile:', error?.message || error);
    return null;
  }
}
