/**
 * src/services/memoryService.ts
 *
 * Appwrite-backed and offline-resilient Memory Service for ChatBox AI APK.
 * Interacts with Appwrite 'conversation_memory' collection.
 * Manages user memories with viewing, toggling inclusion, individual deletion,
 * and bulk clearing with local fallback persistence.
 */

import { databases, DB_ID, CONVERSATION_MEMORY_COLLECTION_ID, Query, ID } from '@/config/appwrite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEMORY_CACHE_PREFIX = '@chatboxai:cached_memories_';

export interface MemorySummary {
  topic?: string;
  summary?: string;
  keyFindings?: string[];
  actionItems?: string[];
  tags?: string[];
}

export interface ConversationMemoryItem {
  $id: string;
  userEmail: string;
  libId?: string;
  fullTranscript?: any[];
  summary: MemorySummary;
  conversationType: 'search' | 'research' | string;
  includedInContext: boolean;
  createdAt: string;
}

export interface MemoriesResult {
  total: number;
  memories: ConversationMemoryItem[];
}

/**
 * Fetch memories for user with pagination and local cache fallback
 */
export async function fetchUserMemories(
  userEmail: string,
  limit: number = 20,
  offset: number = 0
): Promise<MemoriesResult> {
  if (!userEmail) {
    return { total: 0, memories: [] };
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  const cacheKey = `${MEMORY_CACHE_PREFIX}${cleanEmail}`;

  try {
    if (DB_ID && CONVERSATION_MEMORY_COLLECTION_ID) {
      const response = await databases.listDocuments(
        DB_ID,
        CONVERSATION_MEMORY_COLLECTION_ID,
        [
          Query.equal('userEmail', cleanEmail),
          Query.orderDesc('createdAt'),
          Query.limit(limit),
          Query.offset(offset),
        ]
      );

      const parsed: ConversationMemoryItem[] = (response.documents || []).map((doc: any) => {
        let summary: MemorySummary = {};
        if (typeof doc.summary === 'string') {
          try {
            summary = JSON.parse(doc.summary);
          } catch {
            summary = { topic: doc.summary };
          }
        } else if (doc.summary && typeof doc.summary === 'object') {
          summary = doc.summary;
        }

        return {
          $id: doc.$id,
          userEmail: doc.userEmail || cleanEmail,
          libId: doc.libId,
          summary,
          conversationType: doc.conversationType || 'search',
          includedInContext: doc.includedInContext !== false,
          createdAt: doc.createdAt || doc.$createdAt || new Date().toISOString(),
        };
      });

      if (offset === 0) {
        AsyncStorage.setItem(cacheKey, JSON.stringify(parsed)).catch(() => {});
      }

      return {
        total: response.total ?? parsed.length,
        memories: parsed,
      };
    }
  } catch (err: any) {
    console.warn('[memoryService] Appwrite fetch error, falling back to local cache:', err?.message || err);
  }

  // Fallback to local cached memories
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const list: ConversationMemoryItem[] = JSON.parse(cached);
      return {
        total: list.length,
        memories: list.slice(offset, offset + limit),
      };
    }
  } catch {}

  return { total: 0, memories: [] };
}

/**
 * Toggle whether a memory is included in future AI conversation context
 */
export async function toggleMemoryInclusion(
  memoryId: string,
  includedInContext: boolean
): Promise<boolean> {
  if (!memoryId) return false;

  try {
    if (DB_ID && CONVERSATION_MEMORY_COLLECTION_ID && !memoryId.startsWith('local_')) {
      await databases.updateDocument(
        DB_ID,
        CONVERSATION_MEMORY_COLLECTION_ID,
        memoryId,
        { includedInContext }
      );
      return true;
    }
  } catch (err) {
    console.warn('[memoryService] Appwrite toggle error:', err);
  }
  return true;
}

/**
 * Delete a single memory item by ID
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  if (!memoryId) return false;

  try {
    if (DB_ID && CONVERSATION_MEMORY_COLLECTION_ID && !memoryId.startsWith('local_')) {
      await databases.deleteDocument(DB_ID, CONVERSATION_MEMORY_COLLECTION_ID, memoryId);
      return true;
    }
  } catch (err) {
    console.warn('[memoryService] Appwrite delete error:', err);
  }
  return true;
}

/**
 * Clear all memories for a user
 */
export async function clearAllUserMemories(userEmail: string): Promise<boolean> {
  if (!userEmail) return false;

  const cleanEmail = userEmail.trim().toLowerCase();
  const cacheKey = `${MEMORY_CACHE_PREFIX}${cleanEmail}`;

  // Clear local cache immediately
  try {
    await AsyncStorage.removeItem(cacheKey);
  } catch {}

  try {
    if (DB_ID && CONVERSATION_MEMORY_COLLECTION_ID) {
      // Fetch up to 100 memories to delete
      const res = await databases.listDocuments(
        DB_ID,
        CONVERSATION_MEMORY_COLLECTION_ID,
        [Query.equal('userEmail', cleanEmail), Query.limit(100)]
      );

      for (const doc of res.documents || []) {
        try {
          await databases.deleteDocument(DB_ID, CONVERSATION_MEMORY_COLLECTION_ID, doc.$id);
        } catch {}
      }
      return true;
    }
  } catch (err) {
    console.warn('[memoryService] Appwrite clear all error:', err);
  }

  return true;
}
