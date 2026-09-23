import { databases, DB_ID, USERS_COLLECTION_ID, Query, ID } from '@/config/appwrite';
import { auth } from '@/config/firebase';
import { apiClient } from './api/client';

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

  // 1. Authenticated Mobile Backend Proxy Route
  if (auth.currentUser) {
    try {
      const response = await apiClient.get('/api/mobile/user/profile');
      if (response.data && response.data.email) {
        return response.data as UserProfile;
      }
    } catch (err: any) {
      if (__DEV__) {
        console.debug('[userService] Proxy user profile fallback to direct Appwrite:', err?.message || err);
      }
    }
  }

  if (!DB_ID) {
    return buildDefaultUser(normalizedEmail, displayName) as unknown as UserProfile;
  }

  try {
    // Query Appwrite users collection for matching email
    const response = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
      Query.equal('email', normalizedEmail),
      Query.limit(1),
    ]);

    if (response.documents && response.documents.length > 0) {
      const existingUser = response.documents[0] as unknown as UserProfile;

      // Non-blocking last_login timestamp update
      if (existingUser.$id) {
        databases
          .updateDocument(DB_ID, USERS_COLLECTION_ID, existingUser.$id, {
            last_login: new Date().toISOString(),
          })
          .catch((err) => {
            console.warn('[Appwrite] Non-fatal error updating last_login:', err?.message || err);
          });
      }

      return existingUser;
    }

    // If user does not exist in Appwrite and createIfMissing is true, create profile document
    if (createIfMissing) {
      const payload = buildDefaultUser(normalizedEmail, displayName);
      try {
        const createdDoc = await databases.createDocument(
          DB_ID,
          USERS_COLLECTION_ID,
          ID.unique(),
          payload
        );
        return createdDoc as unknown as UserProfile;
      } catch (createErr: any) {
        console.warn(
          '[Appwrite] Permission restricted for createDocument. Using default profile fallback:',
          createErr?.message || createErr
        );
        return {
          $id: 'fallback_' + Date.now(),
          ...payload,
        };
      }
    }

    // Return default offline profile if createIfMissing is false and no doc found
    return {
      $id: 'temp_' + Date.now(),
      ...buildDefaultUser(normalizedEmail, displayName),
    };
  } catch (error: any) {
    // Silent fallback to default user profile object so app never crashes
    return {
      $id: 'local_' + Date.now(),
      ...buildDefaultUser(normalizedEmail, displayName),
    };
  }
}

/**
 * Update user preferences or profile fields in Appwrite.
 */
export async function updateUserProfile(
  docId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  if (docId.startsWith('local_') || docId.startsWith('fallback_') || docId.startsWith('temp_')) {
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
