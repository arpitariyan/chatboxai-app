/**
 * src/server/routes/proxy.ts
 *
 * Secure server-side routes for privileged Appwrite Database operations.
 * Allows complete removal of EXPO_PUBLIC_APPWRITE_API_KEY from mobile client.
 * Matches Master Specification Section 27.
 */

import { Router, Request, Response } from 'express';
import { requireFirebaseUser } from '../lib/firebase-admin';
import {
  databases,
  DB_ID,
  LIBRARY_COLLECTION_ID,
  CHATS_COLLECTION_ID,
  USERS_COLLECTION_ID,
  MFA_OTPS_COLLECTION_ID,
  IMAGE_GENERATION_COLLECTION_ID,
  WEBSITE_PROJECTS_COLLECTION_ID,
  Query,
  ID,
  Permission,
  Role,
} from '../lib/appwrite-admin';
import { BadRequestError, FileForbiddenError } from '../lib/errors';
import { logger } from '../lib/logger';

export const proxyRouter = Router();

const DEFAULT_PERMS = [
  Permission.read(Role.any()),
  Permission.write(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

// ── 1. Fetch User Conversations ──────────────────────────────────────────────
proxyRouter.get('/conversations', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const normalizedEmail = user.email.toLowerCase();
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

    const items: any[] = [];

    // Library
    if (libResult.status === 'fulfilled') {
      for (const doc of libResult.value.documents || []) {
        if ((doc.userEmail || '').toLowerCase() === normalizedEmail) {
          items.push({
            ...doc,
            libId: doc.libId || doc.$id,
            type: doc.type || 'search',
          });
        }
      }
    }

    // Image Generation
    if (imgResult.status === 'fulfilled') {
      const grouped = new Map<string, any>();
      for (const doc of imgResult.value.documents || []) {
        if ((doc.userEmail || '').toLowerCase() !== normalizedEmail) continue;
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
        items.push({
          ...doc,
          libId: convId,
          searchInput: doc.prompt || 'Image Generation',
          type: 'image-generation',
        });
      }
    }

    // Website Projects
    if (wpResult.status === 'fulfilled') {
      for (const doc of wpResult.value.documents || []) {
        if ((doc.user_email || '').toLowerCase() === normalizedEmail) {
          items.push({
            ...doc,
            libId: doc.$id,
            searchInput: doc.title || doc.project_name || doc.name || doc.initial_prompt || 'Website Project',
            type: 'website-builder',
          });
        }
      }
    }

    // Deduplicate by libId
    const seenLibIds = new Set<string>();
    const deduped: any[] = [];
    for (const item of items) {
      const id = item.libId || item.$id;
      if (!id || seenLibIds.has(id)) continue;
      seenLibIds.add(id);
      deduped.push(item);
    }

    // Sort descending by date
    deduped.sort((a, b) => {
      const timeA = new Date(a.created_at || a.$createdAt || 0).getTime();
      const timeB = new Date(b.created_at || b.$createdAt || 0).getTime();
      return timeB - timeA;
    });

    res.status(200).json({ documents: deduped });
  } catch (err: any) {
    logger.warn('Error fetching user conversations:', { email: user.email, error: err.message });
    res.status(500).json({ error: err.message || 'Failed to fetch conversations' });
  }
});

// ── 2. Fetch Conversation Turns ──────────────────────────────────────────────
proxyRouter.get('/conversations/:libId/chats', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const libId = req.params.libId;

  try {
    // Verify user owns the conversation
    const libRes = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
      Query.equal('libId', libId),
      Query.limit(1),
    ]);
    const libDoc: any = (libRes.documents || [])[0];

    if (libDoc && (libDoc.userEmail || '').toLowerCase() !== user.email.toLowerCase()) {
      throw new FileForbiddenError('Conversation does not belong to this user');
    }

    const chatsRes = await databases.listDocuments(DB_ID, CHATS_COLLECTION_ID, [
      Query.equal('libId', libId),
      Query.limit(500),
    ]);

    const sorted = (chatsRes.documents || []).sort((a: any, b: any) => {
      const timeA = new Date(a.$createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.$createdAt || b.created_at || 0).getTime();
      return timeA - timeB;
    });

    res.status(200).json({ documents: sorted });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Failed to fetch chats' });
  }
});

// ── 3. Create Conversation ───────────────────────────────────────────────────
proxyRouter.post('/conversations', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const { libId, searchInput, type = 'search', selectedModel, modelName } = req.body || {};

  if (!libId || !searchInput) {
    throw new BadRequestError('Fields "libId" and "searchInput" are required');
  }

  try {
    const payload = {
      libId,
      userEmail: user.email.toLowerCase(),
      searchInput: searchInput.trim(),
      type,
      selectedModel: selectedModel || 'auto',
      modelName: modelName || 'Auto',
      created_at: new Date().toISOString(),
      hasFiles: false,
      analyzedFilesCount: 0,
    };

    let doc: any;
    try {
      doc = await databases.createDocument(DB_ID, LIBRARY_COLLECTION_ID, libId, payload, DEFAULT_PERMS);
    } catch {
      doc = await databases.createDocument(DB_ID, LIBRARY_COLLECTION_ID, ID.unique(), payload, DEFAULT_PERMS);
    }

    res.status(200).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create conversation' });
  }
});

// ── 4. Add Chat Turn ─────────────────────────────────────────────────────────
proxyRouter.post('/chats', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    libId,
    userSearchInput,
    aiResp,
    searchResult,
    analysisType = 'text_only',
    usedModel,
    modelApi,
    analyzedFilesCount = 0,
    processedFiles,
    isThinkingMode = false,
  } = req.body || {};

  if (!libId) {
    throw new BadRequestError('Field "libId" is required');
  }

  try {
    const payload: Record<string, any> = {
      libId,
      userSearchInput: userSearchInput || '',
      aiResp: aiResp || '',
      searchResult: searchResult || '',
      analysisType,
      created_at: new Date().toISOString(),
      liked: 'false',
      disliked: 'false',
      analyzedFilesCount,
      isThinkingMode: !!isThinkingMode,
    };

    if (processedFiles) payload.processedFiles = processedFiles;
    if (usedModel) payload.usedModel = usedModel;
    if (modelApi) payload.modelApi = modelApi;

    const doc = await databases.createDocument(DB_ID, CHATS_COLLECTION_ID, ID.unique(), payload, DEFAULT_PERMS);
    res.status(200).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create chat turn' });
  }
});

// ── 5. Update Feedback ───────────────────────────────────────────────────────
proxyRouter.put('/chats/:id/feedback', requireFirebaseUser, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { field, value } = req.body || {};

  if (!id || (field !== 'liked' && field !== 'disliked')) {
    throw new BadRequestError('Invalid feedback payload');
  }

  try {
    await databases.updateDocument(DB_ID, CHATS_COLLECTION_ID, id, {
      [field]: value ? 'true' : 'false',
    });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update feedback' });
  }
});

// ── 6. Rename Conversation ───────────────────────────────────────────────────
proxyRouter.put('/conversations/:libId', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const libId = req.params.libId;
  const { newTitle } = req.body || {};

  if (!libId || !newTitle) {
    throw new BadRequestError('Fields "libId" and "newTitle" are required');
  }

  try {
    const resDocs = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
      Query.equal('libId', libId),
      Query.limit(5),
    ]);

    for (const doc of resDocs.documents || []) {
      if ((doc.userEmail || '').toLowerCase() === user.email.toLowerCase()) {
        await databases.updateDocument(DB_ID, LIBRARY_COLLECTION_ID, doc.$id, {
          searchInput: String(newTitle).trim(),
        });
        return res.status(200).json({ success: true });
      }
    }

    res.status(404).json({ error: 'Conversation not found or not owned by user' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename conversation' });
  }
});

// ── 7. Delete Conversation ───────────────────────────────────────────────────
proxyRouter.delete('/conversations/:libId', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const libId = req.params.libId;

  try {
    const resDocs = await databases.listDocuments(DB_ID, LIBRARY_COLLECTION_ID, [
      Query.equal('libId', libId),
      Query.limit(5),
    ]);

    const matching = (resDocs.documents || []).find(
      (doc: any) => (doc.userEmail || '').toLowerCase() === user.email.toLowerCase()
    );

    if (!matching) {
      return res.status(404).json({ error: 'Conversation not found or unauthorized' });
    }

    // Delete associated chats
    try {
      const chatsRes = await databases.listDocuments(DB_ID, CHATS_COLLECTION_ID, [
        Query.equal('libId', libId),
        Query.limit(200),
      ]);
      for (const chat of chatsRes.documents || []) {
        await databases.deleteDocument(DB_ID, CHATS_COLLECTION_ID, chat.$id);
      }
    } catch {
      // Continue
    }

    await databases.deleteDocument(DB_ID, LIBRARY_COLLECTION_ID, matching.$id);
    res.status(200).json({ success: true, deleted: libId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete conversation' });
  }
});

// ── 8. User Profile ──────────────────────────────────────────────────────────
proxyRouter.get('/user/profile', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;

  try {
    const list = await databases.listDocuments(DB_ID, USERS_COLLECTION_ID, [
      Query.equal('email', user.email.toLowerCase()),
      Query.limit(1),
    ]);

    if (list.documents && list.documents.length > 0) {
      return res.status(200).json(list.documents[0]);
    }

    // Auto-create default user profile
    const now = new Date().toISOString();
    const defaultProfile = {
      email: user.email.toLowerCase(),
      name: user.email.split('@')[0],
      plan: 'free',
      credits: 5000,
      last_monthly_reset: now.split('T')[0],
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

    const created = await databases.createDocument(
      DB_ID,
      USERS_COLLECTION_ID,
      ID.unique(),
      defaultProfile,
      DEFAULT_PERMS
    );
    res.status(200).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve profile' });
  }
});
