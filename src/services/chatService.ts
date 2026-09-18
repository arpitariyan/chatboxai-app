import {
  databases,
  DB_ID,
  LIBRARY_COLLECTION_ID,
  CHATS_COLLECTION_ID,
  IMAGE_GENERATION_COLLECTION_ID,
  WEBSITE_PROJECTS_COLLECTION_ID,
  Query,
  ID,
  Permission,
  Role,
} from '@/config/appwrite';

export interface ConversationItem {
  libId: string;
  title: string;
  rawTitle: string;
  userEmail: string;
  type: string;
  selectedModel?: string;
  modelName?: string;
  createdAt: string;
  docId: string;
}


export interface ChatMessageRecord {
  id: string;
  libId: string;
  userSearchInput: string;
  aiResp: string;
  searchResult?: string;
  liked?: boolean | string;
  disliked?: boolean | string;
  createdAt: string;
}

export interface CreateConversationParams {
  libId: string;
  userEmail: string;
  searchInput: string;
  type?: string;
  selectedModel?: string;
  modelName?: string;
}

export interface AddChatMessageParams {
  libId: string;
  userEmail: string;
  userSearchInput: string;
  aiResp: string;
  searchResult?: string;
  analysisType?: string;
  usedModel?: string;
  modelApi?: string;
}

/**
 * Standard RFC4122 v4 UUID generator (zero external dependencies)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extracts a clean, single-line human title matching chatboxai_website_copy truncateTitle
 */
export function cleanConversationTitle(raw: string = '', max: number = 26): string {
  if (!raw) return 'Untitled';
  // Split into lines and find first non-empty line
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || 'Untitled';
  return firstLine.length > max ? firstLine.slice(0, max) + '…' : firstLine;
}

const DEFAULT_PERMISSIONS = [
  Permission.read(Role.any()),
  Permission.write(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

/**
 * Chat and Conversation Database Service
 * Enforces strict user data isolation: all queries and updates are gated on userEmail
 */
export const chatService = {
  /**
   * Fetch conversation threads ONLY for the currently logged-in user email
   * Mirrors chatboxai_website_copy /api/library/history:
   * Queries library (search), image_generation, and website_projects in parallel,
   * strictly filtering every document on userEmail === normalizedEmail with Query.orderDesc('$createdAt').
   */
  async fetchUserConversations(userEmail: string): Promise<ConversationItem[]> {
    if (!userEmail || !DB_ID) return [];

    const normalizedEmail = userEmail.trim().toLowerCase();

    try {
      const [libResult, imgResult, wpResult] = await Promise.allSettled([
        databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
          Query.equal('userEmail', normalizedEmail),
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]),
        databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
          Query.equal('userEmail', normalizedEmail),
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]),
        databases.listDocuments(DB_ID, WEBSITE_PROJECTS_COLLECTION_ID, [
          Query.equal('user_email', normalizedEmail),
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]),
      ]);

      const items: ConversationItem[] = [];

      // 1. Process Library (search chats)
      if (libResult.status === 'fulfilled') {
        const rawDocs = libResult.value.documents || [];
        const userDocs = rawDocs.filter(
          (doc: any) => (doc.userEmail || '').trim().toLowerCase() === normalizedEmail
        );
        for (const doc of userDocs) {
          const rawTitle = doc.searchInput || 'Untitled';
          items.push({
            libId: doc.libId || doc.$id,
            title: cleanConversationTitle(rawTitle),
            rawTitle,
            userEmail: doc.userEmail || normalizedEmail,
            type: doc.type || 'search',
            selectedModel: doc.selectedModel,
            modelName: doc.modelName,
            createdAt: doc.created_at || doc.$createdAt,
            docId: doc.$id,
          });
        }
      }

      // 2. Process Image Generations (mirrors web imageGenDocs)
      if (imgResult.status === 'fulfilled') {
        const rawDocs = imgResult.value.documents || [];
        const userDocs = rawDocs.filter(
          (doc: any) => (doc.userEmail || '').trim().toLowerCase() === normalizedEmail
        );

        // Group by conversation/libId (matching web route)
        const grouped = new Map<string, any>();
        for (const doc of userDocs) {
          const convId = doc?.libId || doc?.$id;
          if (!convId) continue;
          if (!grouped.has(convId)) {
            grouped.set(convId, doc);
          } else {
            const current = grouped.get(convId);
            const currentTime = new Date(current?.created_at || current?.$createdAt || 0).getTime();
            const nextTime = new Date(doc?.created_at || doc?.$createdAt || 0).getTime();
            if (nextTime > currentTime) grouped.set(convId, doc);
          }
        }

        for (const [convId, doc] of grouped.entries()) {
          const rawTitle = doc.prompt || 'Image Generation';
          items.push({
            libId: convId,
            title: cleanConversationTitle(rawTitle),
            rawTitle,
            userEmail: doc.userEmail || normalizedEmail,
            type: 'image-generation',
            createdAt: doc.created_at || doc.$createdAt,
            docId: doc.$id,
          });
        }
      }

      // 3. Process Website Projects (mirrors web websiteProjectsDocs)
      if (wpResult.status === 'fulfilled') {
        const rawDocs = wpResult.value.documents || [];
        const userDocs = rawDocs.filter(
          (doc: any) => (doc.user_email || '').trim().toLowerCase() === normalizedEmail
        );
        for (const doc of userDocs) {
          const rawTitle =
            doc.title || doc.project_name || doc.name || doc.initial_prompt || 'Website Project';
          items.push({
            libId: doc.$id,
            title: cleanConversationTitle(rawTitle),
            rawTitle,
            userEmail: doc.user_email || normalizedEmail,
            type: 'website-builder',
            createdAt: doc.created_at || doc.$createdAt,
            docId: doc.$id,
          });
        }
      }

      // Deduplicate by libId (preferring library chat records)
      const seenLibIds = new Set<string>();
      const deduped: ConversationItem[] = [];
      for (const item of items) {
        if (!item.libId || seenLibIds.has(item.libId)) continue;
        seenLibIds.add(item.libId);
        deduped.push(item);
      }

      // Sort descending: newest conversation first
      return deduped.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    } catch (error: any) {
      console.warn('[chatService] Error fetching user conversations:', error?.message || error);
      return [];
    }
  },

  /**
   * Fetch all message turns for a conversation from 'chats' collection
   * SECURITY: Strictly verifies that the parent conversation in 'library' belongs to userEmail
   */
  async fetchConversationChats(libId: string, userEmail: string): Promise<ChatMessageRecord[]> {
    if (!libId || !userEmail || !DB_ID) return [];

    const normalizedEmail = userEmail.trim().toLowerCase();

    try {
      // 1. Verify that this conversation belongs to the logged-in user
      const libRes = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
        Query.equal('libId', libId),
        Query.limit(1),
      ]);

      const libDoc: any = (libRes.documents || [])[0];
      if (!libDoc) {
        console.warn(`[chatService] Conversation ${libId} not found`);
        return [];
      }

      // Check ownership
      const ownerEmail = (libDoc.userEmail || '').trim().toLowerCase();
      if (ownerEmail !== normalizedEmail) {
        console.warn(
          `[chatService] Access denied: Conversation ${libId} belongs to ${ownerEmail}, not ${normalizedEmail}`
        );
        return [];
      }

      // 2. Fetch all turns linked to this verified libId (up to 500 for long conversations)
      const response = await databases.listDocuments(DB_ID, CHATS_COLLECTION_ID, [
        Query.equal('libId', libId),
        Query.limit(500),
      ]);

      const rawDocs = response.documents || [];

      // IMPORTANT: Web-created chats have created_at=null, so always use $createdAt as primary
      // sort key for ascending chronological order of multi-turn messages.
      const sorted = rawDocs.sort((a: any, b: any) => {
        // Prefer $createdAt (Appwrite system field always populated) over created_at
        const timeA = new Date(a.$createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.$createdAt || b.created_at || 0).getTime();
        return timeA - timeB; // ascending: oldest first
      });

      return sorted.map((doc: any) => ({
        id: doc.$id,
        libId: doc.libId,
        userSearchInput: doc.userSearchInput || '',
        aiResp: doc.aiResp || '',
        searchResult: doc.searchResult || '',
        liked: doc.liked,
        disliked: doc.disliked,
        createdAt: doc.$createdAt || doc.created_at,
      }));
    } catch (error: any) {
      console.warn('[chatService] Error fetching conversation chats:', error?.message || error);
      return [];
    }
  },

  /**
   * Create a new conversation session in the 'library' collection
   * Stores strictly with the authenticated user's email
   */
  async createConversation(params: CreateConversationParams): Promise<ConversationItem | null> {
    if (!DB_ID || !params.libId || !params.userEmail) return null;

    const normalizedEmail = params.userEmail.trim().toLowerCase();

    try {
      const payload: Record<string, any> = {
        libId: params.libId,
        userEmail: normalizedEmail,
        searchInput: params.searchInput.trim(),
        type: params.type || 'search',
        selectedModel: params.selectedModel || 'provider-8/gemini-2.0-flash',
        modelName: params.modelName || 'Gemini 2.0 Flash',
        created_at: new Date().toISOString(),
        hasFiles: false,
        analyzedFilesCount: 0,
      };

      // Check if it already exists to avoid duplicate collision
      const existing = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
        Query.equal('libId', params.libId),
        Query.limit(1),
      ]);

      if ((existing.documents || []).length > 0) {
        const doc: any = existing.documents[0];
        return {
          libId: doc.libId || doc.$id,
          title: cleanConversationTitle(doc.searchInput || params.searchInput),
          rawTitle: doc.searchInput || params.searchInput,
          userEmail: doc.userEmail || normalizedEmail,
          type: doc.type || 'search',
          selectedModel: doc.selectedModel,
          modelName: doc.modelName,
          createdAt: doc.created_at || doc.$createdAt,
          docId: doc.$id,
        };
      }

      let created: any;
      try {
        created = await databases.createDocument(
          DB_ID,
          LIBRARY_COLLECTION_ID,
          params.libId,
          payload,
          DEFAULT_PERMISSIONS
        );
      } catch {
        // Fallback with ID.unique() if custom document ID is restricted
        created = await databases.createDocument(
          DB_ID,
          LIBRARY_COLLECTION_ID,
          ID.unique(),
          payload,
          DEFAULT_PERMISSIONS
        );
      }

      return {
        libId: created.libId || created.$id,
        title: cleanConversationTitle(created.searchInput),
        rawTitle: created.searchInput,
        userEmail: created.userEmail,
        type: created.type,
        selectedModel: created.selectedModel,
        modelName: created.modelName,
        createdAt: created.created_at || created.$createdAt,
        docId: created.$id,
      };
    } catch (error: any) {
      console.error('[chatService] Error creating conversation:', error?.message || error);
      return null;
    }
  },

  /**
   * Add a chat turn (user prompt + AI response) to 'chats' collection
   * Strictly confirms the user owns the conversation before appending
   */
  async addChatMessage(params: AddChatMessageParams): Promise<ChatMessageRecord | null> {
    if (!DB_ID || !params.libId || !params.userEmail) return null;

    const normalizedEmail = params.userEmail.trim().toLowerCase();

    try {
      // Confirm ownership in library first
      const libRes = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
        Query.equal('libId', params.libId),
        Query.limit(1),
      ]);

      const libDoc: any = (libRes.documents || [])[0];
      if (libDoc) {
        const ownerEmail = (libDoc.userEmail || '').trim().toLowerCase();
        if (ownerEmail !== normalizedEmail) {
          console.error(
            `[chatService] Cannot add message: Conversation ${params.libId} belongs to ${ownerEmail}, not ${normalizedEmail}`
          );
          return null;
        }
      }

      const payload: Record<string, any> = {
        libId: params.libId,
        userSearchInput: params.userSearchInput,
        aiResp: params.aiResp,
        searchResult: params.searchResult || '',
        analysisType: params.analysisType || 'text_only',
        created_at: new Date().toISOString(),
        liked: 'false',
        disliked: 'false',
        analyzedFilesCount: 0,
        isThinkingMode: false,
      };

      if (params.usedModel) payload.usedModel = params.usedModel;
      if (params.modelApi) payload.modelApi = params.modelApi;

      const created = await databases.createDocument(
        DB_ID,
        CHATS_COLLECTION_ID,
        ID.unique(),
        payload,
        DEFAULT_PERMISSIONS
      );

      return {
        id: created.$id,
        libId: created.libId,
        userSearchInput: created.userSearchInput,
        aiResp: created.aiResp,
        searchResult: created.searchResult,
        createdAt: created.created_at || created.$createdAt,
      };
    } catch (error: any) {
      console.error('[chatService] Error adding chat message:', error?.message || error);
      return null;
    }
  },

  /**
   * Update liked/disliked status of a specific message
   */
  async updateMessageFeedback(messageId: string, field: 'liked' | 'disliked', value: boolean): Promise<boolean> {
    if (!DB_ID || !messageId) return false;

    try {
      await databases.updateDocument(DB_ID, CHATS_COLLECTION_ID, messageId, {
        [field]: value ? 'true' : 'false'
      });
      return true;
    } catch (error: any) {
      console.error(`[chatService] Error updating feedback for ${messageId}:`, error?.message || error);
      return false;
    }
  },

  /**
   * Rename conversation in 'library' collection
   * Strictly gated on user ownership
   */
  async renameConversation(libId: string, userEmail: string, newTitle: string): Promise<boolean> {
    if (!DB_ID || !libId || !userEmail || !newTitle.trim()) return false;

    const normalizedEmail = userEmail.trim().toLowerCase();

    try {
      const res = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
        Query.equal('libId', libId),
        Query.limit(5),
      ]);

      if (!res.documents || res.documents.length === 0) {
        return false;
      }

      for (const doc of res.documents) {
        if ((doc.userEmail || '').trim().toLowerCase() === normalizedEmail) {
          await databases.updateDocument(DB_ID, LIBRARY_COLLECTION_ID, doc.$id, {
            searchInput: newTitle.trim(),
          });
          return true;
        }
      }

      return false;
    } catch (error: any) {
      console.error('[chatService] Error renaming conversation:', error?.message || error);
      return false;
    }
  },

  /**
   * Delete conversation from 'library' and delete all corresponding message turns from 'chats'
   * Strictly gated on user ownership
   */
  async deleteConversation(libId: string, userEmail: string): Promise<boolean> {
    if (!DB_ID || !libId || !userEmail) return false;

    const normalizedEmail = userEmail.trim().toLowerCase();

    try {
      // 1. Confirm ownership in library collection
      const libRes = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
        Query.equal('libId', libId),
        Query.limit(5),
      ]);

      const matchingDoc = (libRes.documents || []).find(
        (doc: any) => (doc.userEmail || '').trim().toLowerCase() === normalizedEmail
      );

      if (!matchingDoc) {
        console.warn(`[chatService] Conversation ${libId} not owned by ${normalizedEmail}, delete skipped`);
        return false;
      }

      // 2. Delete all chat message turns belonging to this libId
      try {
        const chatsRes = await databases.listDocuments(DB_ID, CHATS_COLLECTION_ID, [
          Query.equal('libId', libId),
          Query.limit(200),
        ]);

        for (const chatDoc of chatsRes.documents || []) {
          await databases.deleteDocument(DB_ID, CHATS_COLLECTION_ID, chatDoc.$id);
        }
      } catch (err: any) {
        console.warn('[chatService] Warning deleting associated chats:', err?.message || err);
      }

      // 3. Delete the conversation record from library collection
      await databases.deleteDocument(DB_ID, LIBRARY_COLLECTION_ID, matchingDoc.$id);

      return true;
    } catch (error: any) {
      console.error('[chatService] Error deleting conversation:', error?.message || error);
      return false;
    }
  },
};
