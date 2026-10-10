/**
 * src/services/memoryService.ts
 *
 * Appwrite-backed and offline-resilient Memory Service for ChatBox AI APK.
 * Interacts with Appwrite 'conversation_memory' collection.
 * Manages user memories with viewing, toggling inclusion, individual deletion,
 * and bulk clearing with local fallback persistence.
 */

import { databases, DB_ID, CONVERSATION_MEMORY_COLLECTION_ID, Query, ID } from '@/config/appwrite';
import { secureStorage } from './security/SecureStorageService';

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
        secureStorage.setEncryptedJson(cacheKey, parsed).catch(() => {});
      }

      return {
        total: response.total ?? parsed.length,
        memories: parsed,
      };
    }
  } catch (err: any) {
    console.warn('[memoryService] Appwrite fetch error, falling back to local cache:', err?.message || err);
  }

  // Fallback to AES-256 encrypted local cached memories
  try {
    const list = await secureStorage.getEncryptedJson<ConversationMemoryItem[]>(cacheKey, []);
    if (list.length > 0) {
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
    await secureStorage.removeItem(cacheKey);
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

/**
 * Save or update a conversation memory document in Appwrite 'conversation_memory' collection.
 * Matches exact Appwrite collection schema:
 * - userEmail (string, 255)
 * - libId (string, 255)
 * - fullTranscript (string, 1000000)
 * - summary (string, 500000)
 * - conversationType (string, 50)
 * - includedInContext (boolean)
 * - createdAt (string, 255)
 */
export async function saveOrUpdateConversationMemory(params: {
  userEmail: string;
  libId: string;
  fullTranscript: string | Array<{ role: string; content: string }>;
  summary?: string | MemorySummary;
  conversationType?: string;
  includedInContext?: boolean;
}): Promise<ConversationMemoryItem | null> {
  const cleanEmail = (params.userEmail || '').trim().toLowerCase();
  const cleanLibId = (params.libId || '').trim();
  if (!cleanEmail || !cleanLibId) return null;

  // 1. Prepare string payload for fullTranscript
  const transcriptStr = typeof params.fullTranscript === 'string'
    ? params.fullTranscript
    : JSON.stringify(params.fullTranscript || []);

  // 2. Prepare summary payload
  let summaryObj: MemorySummary = {};
  let summaryStr = '';
  if (typeof params.summary === 'string') {
    try {
      summaryObj = JSON.parse(params.summary);
      summaryStr = params.summary;
    } catch {
      summaryObj = { topic: params.summary.slice(0, 80), summary: params.summary };
      summaryStr = JSON.stringify(summaryObj);
    }
  } else if (params.summary && typeof params.summary === 'object') {
    summaryObj = params.summary;
    summaryStr = JSON.stringify(params.summary);
  } else {
    // Generate initial summary from transcript
    const preview = transcriptStr.slice(0, 300);
    summaryObj = {
      topic: 'Conversation ' + cleanLibId.slice(0, 8),
      summary: preview,
    };
    summaryStr = JSON.stringify(summaryObj);
  }

  const convType = (params.conversationType || 'chat').slice(0, 50);
  const incInCtx = params.includedInContext !== false;
  const nowIso = new Date().toISOString();

  const payload = {
    userEmail: cleanEmail.slice(0, 255),
    libId: cleanLibId.slice(0, 255),
    fullTranscript: transcriptStr.slice(0, 1000000),
    summary: summaryStr.slice(0, 500000),
    conversationType: convType,
    includedInContext: incInCtx,
    createdAt: nowIso.slice(0, 255),
  };

  let savedDocId = '';

  try {
    if (DB_ID && CONVERSATION_MEMORY_COLLECTION_ID) {
      // Check if document exists for this libId & userEmail
      const existing = await databases.listDocuments(
        DB_ID,
        CONVERSATION_MEMORY_COLLECTION_ID,
        [
          Query.equal('userEmail', cleanEmail),
          Query.equal('libId', cleanLibId),
          Query.limit(1),
        ]
      );

      if (existing.documents && existing.documents.length > 0) {
        const docId = existing.documents[0].$id;
        savedDocId = docId;
        await databases.updateDocument(
          DB_ID,
          CONVERSATION_MEMORY_COLLECTION_ID,
          docId,
          {
            fullTranscript: payload.fullTranscript,
            summary: payload.summary,
            conversationType: payload.conversationType,
            includedInContext: payload.includedInContext,
          }
        );
      } else {
        const created = await databases.createDocument(
          DB_ID,
          CONVERSATION_MEMORY_COLLECTION_ID,
          ID.unique(),
          payload
        );
        savedDocId = created.$id;
      }
    }
  } catch (err: any) {
    console.warn('[memoryService] Appwrite saveOrUpdate error:', err?.message || err);
  }

  // Update local AES-256 encrypted cache
  const memoryItem: ConversationMemoryItem = {
    $id: savedDocId || `local_${Date.now()}`,
    userEmail: cleanEmail,
    libId: cleanLibId,
    fullTranscript: [transcriptStr],
    summary: summaryObj,
    conversationType: convType,
    includedInContext: incInCtx,
    createdAt: nowIso,
  };

  try {
    const cacheKey = `${MEMORY_CACHE_PREFIX}${cleanEmail}`;
    const list = await secureStorage.getEncryptedJson<ConversationMemoryItem[]>(cacheKey, []);
    const filtered = list.filter((m) => m.libId !== cleanLibId);
    filtered.unshift(memoryItem);
    await secureStorage.setEncryptedJson(cacheKey, filtered.slice(0, 100));
  } catch (cacheErr) {
    console.warn('[memoryService] Cache update error:', cacheErr);
  }

  return memoryItem;
}

/**
 * Retrieve active memories marked as includedInContext for inclusion in LLM prompt.
 */
export async function getActiveContextMemories(userEmail: string, limit: number = 5): Promise<string> {
  if (!userEmail) return '';
  try {
    const { memories } = await fetchUserMemories(userEmail, limit, 0);
    const active = memories.filter((m) => m.includedInContext);
    if (active.length === 0) return '';

    return active
      .map((m) => {
        const topic = m.summary?.topic ? `[${m.summary.topic}] ` : '';
        const desc = m.summary?.summary || '';
        return `- ${topic}${desc}`.trim();
      })
      .filter((line) => line.length > 2)
      .join('\n');
  } catch {
    return '';
  }
}

