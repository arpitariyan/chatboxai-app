/**
 * src/server/routes/image.ts
 *
 * Dedicated mobile API routes for Image Generation & Image-to-Image.
 * - POST /api/mobile/image/generate
 * - GET  /api/mobile/image/generations?libId=...
 * - GET  /api/mobile/image/file?fileId=...
 * - DEL  /api/mobile/image/conversation/:libId
 */

import { Router, Request, Response } from 'express';
import { requireFirebaseUser } from '../lib/firebase-admin';
import {
  executeImageGeneration,
  getImageGenerationsForUser,
  getPublicFileUrl,
} from '../lib/image-generator';
import {
  databases,
  storage,
  DB_ID,
  STORAGE_BUCKET_ID,
  IMAGE_GENERATION_COLLECTION_ID,
  Query,
} from '../lib/appwrite-admin';
import { BadRequestError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';

export const imageRouter = Router();

// Informational route
imageRouter.get('/image', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'chatboxai-mobile-image-generation',
    endpoints: {
      generate: 'POST /api/mobile/image/generate',
      generations: 'GET  /api/mobile/image/generations?libId=<id>',
      file: 'GET  /api/mobile/image/file?fileId=<id>',
      delete: 'DELETE /api/mobile/image/conversation/:libId',
    },
  });
});

// ── 1. Generate Image (Text-to-Image or Image-to-Image) ──────────────────────
imageRouter.post('/image/generate', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const {
    prompt,
    model,
    provider,
    width,
    height,
    referenceImage,
    referenceImageBase64,
    libId,
  } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new BadRequestError('Prompt is required for image generation');
  }

  logger.info(`Received image generation request: user=${user.email}, model=${model || 'default'}, prompt="${prompt.slice(0, 40)}..."`);

  try {
    const result = await executeImageGeneration({
      prompt,
      userEmail: user.email,
      model,
      provider,
      width,
      height,
      referenceImage,
      referenceImageBase64,
      libId,
    });

    res.status(200).json(result);
  } catch (err: any) {
    logger.error('Image generation route error:', { error: err.message, stack: err.stack });
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Image generation failed',
    });
  }
});

// ── 2. Fetch Thread Generations by libId ─────────────────────────────────────
imageRouter.get('/image/generations', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const libId = String(req.query.libId || '').trim();

  if (!libId) {
    throw new BadRequestError('Query parameter "libId" is required');
  }

  try {
    const generations = await getImageGenerationsForUser(libId, user.email);
    res.status(200).json({
      success: true,
      libId,
      generations,
    });
  } catch (err: any) {
    logger.error('Error fetching image generations for libId:', { error: err.message, libId });
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch image generations',
    });
  }
});

// ── 3. Proxy Image File Bytes ────────────────────────────────────────────────
imageRouter.get('/image/file', async (req: Request, res: Response) => {
  const fileId = String(req.query.fileId || '').trim();

  if (!fileId) {
    throw new BadRequestError('Query parameter "fileId" is required');
  }

  try {
    const fileViewUrl = getPublicFileUrl(fileId);
    const upstreamRes = await fetch(fileViewUrl);

    if (!upstreamRes.ok) {
      throw new NotFoundError(`Image file ${fileId} not accessible`);
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/png';
    const cacheControl = upstreamRes.headers.get('cache-control') || 'public, max-age=86400';
    const arrayBuffer = await upstreamRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Failed to proxy image file' });
  }
});

// ── 4. Delete Entire Image Conversation by libId ─────────────────────────────
imageRouter.delete('/image/conversation/:libId', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const libId = String(req.params.libId || '').trim();

  if (!libId) {
    throw new BadRequestError('Parameter "libId" is required');
  }

  const normalizedEmail = user.email.trim().toLowerCase();

  try {
    const resDocs = await databases.listDocuments(DB_ID, IMAGE_GENERATION_COLLECTION_ID, [
      Query.equal('libId', libId),
      Query.equal('userEmail', normalizedEmail),
      Query.limit(100),
    ]);

    let deletedCount = 0;
    for (const doc of resDocs.documents || []) {
      await databases.deleteDocument(DB_ID, IMAGE_GENERATION_COLLECTION_ID, doc.$id);
      deletedCount++;
    }

    logger.info(`Deleted ${deletedCount} image generation documents for libId=${libId}`);
    res.status(200).json({ success: true, deletedCount, libId });
  } catch (err: any) {
    logger.error('Error deleting image conversation:', { error: err.message, libId });
    res.status(500).json({ error: err.message || 'Failed to delete image conversation' });
  }
});
