/**
 * src/server/routes/analyze.ts
 *
 * POST /api/mobile/analyze
 * Authenticated AI Multimodal Analysis Route.
 * Matches Master Specification Section 12.
 */

import { Router, Request, Response } from 'express';
import { requireFirebaseUser } from '../lib/firebase-admin';
import { storage } from '../lib/appwrite-admin';
import { resolveFileOwnership } from '../lib/ownership';
import { analyzeFiles, AnalysisFileItem } from '../lib/ai';
import { analyzeLimiter } from '../lib/rate-limit';
import { RateLimitedError, BadRequestError } from '../lib/errors';
import { logger } from '../lib/logger';

export const analyzeRouter = Router();

analyzeRouter.post('/analyze', requireFirebaseUser, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { prompt, fileIds, conversationHistory, memoryEnabled = true } = req.body || {};

  // Rate limiting check
  const rateCheck = analyzeLimiter.check(user.uid);
  if (!rateCheck.allowed) {
    throw new RateLimitedError('Analysis rate limit exceeded', rateCheck.retryAfter);
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new BadRequestError('Field "prompt" is required');
  }

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new BadRequestError('Field "fileIds" must be a non-empty array of file IDs');
  }

  logger.info('Processing file analysis request:', {
    uid: user.uid,
    fileCount: fileIds.length,
    promptPreview: prompt.slice(0, 60),
  });

  try {
    // 1. Verify ownership of every single requested file
    const resolvedFiles: AnalysisFileItem[] = [];

    for (const rawFileId of fileIds) {
      const fileId = String(rawFileId || '').trim();
      if (!fileId) continue;

      // Ownership verification (403 if unauthorized, 404 if nonexistent)
      const resolved = await resolveFileOwnership(fileId, user);

      // Download file buffer server-side from Appwrite Storage
      const fileData = await storage.getFileDownload(resolved.bucketId, resolved.fileId);
      const buffer = Buffer.from(fileData);

      resolvedFiles.push({
        fileId: resolved.fileId,
        bucketId: resolved.bucketId,
        fileName: resolved.fileName,
        mimeType: resolved.mimeType,
        buffer,
      });
    }

    if (resolvedFiles.length === 0) {
      throw new BadRequestError('No valid files could be retrieved for analysis');
    }

    // 2. Invoke unified AI multimodal engine (Gemini with NVIDIA failover)
    const result = await analyzeFiles({
      user,
      prompt: prompt.trim(),
      files: resolvedFiles,
      conversationHistory,
      memoryEnabled,
    });

    // 3. Return normalized response (never return raw server API keys)
    res.status(200).json({
      aiResponse: result.aiResponse,
      thinkingContent: result.thinkingContent,
      searchResult: result.searchResult || null,
    });
  } catch (err: any) {
    logger.error('Analysis failed:', {
      uid: user.uid,
      error: err.message,
    });
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.message || 'File analysis failed',
      code: err.code || 'INTERNAL_ERROR',
    });
  }
});
