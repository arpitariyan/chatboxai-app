/**
 * src/server/routes/file.ts
 *
 * GET /api/mobile/file?fileId=<id>
 * DELETE /api/mobile/file?fileId=<id>
 * The ONLY canonical authenticated file endpoint for the mobile app.
 * Matches Master Specification Sections 14, 15, 16, 31.
 */

import { Router, Request, Response } from 'express';
import { requireFirebaseUser } from '../lib/firebase-admin';
import { storage } from '../lib/appwrite-admin';
import { resolveFileOwnership } from '../lib/ownership';
import { deleteAttachmentRecord } from '../lib/attachment-repository';
import { fileViewLimiter } from '../lib/rate-limit';
import { RateLimitedError, BadRequestError } from '../lib/errors';
import { logger } from '../lib/logger';

export const fileRouter = Router();

fileRouter.get('/file', (req: Request, res: Response, next) => {
  // If visited directly in browser without fileId or auth, return helpful endpoint status
  if (!req.query.fileId && !req.headers.authorization && !req.headers['x-firebase-token']) {
    res.status(200).json({
      ok: true,
      service: 'chatboxai-mobile-file',
      endpoint: '/api/mobile/file',
      method: 'GET',
      status: 'ready',
      auth: 'Bearer token required',
      usage: 'GET /api/mobile/file?fileId=<id> with Authorization: Bearer <token>',
      description: 'Authenticated binary file retrieval endpoint for mobile attachments.',
    });
    return;
  }
  next();
}, requireFirebaseUser, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const fileId = req.query.fileId as string;

  if (!fileId || typeof fileId !== 'string') {
    throw new BadRequestError('Query parameter "fileId" is required');
  }

  // Rate limit check
  const rateCheck = fileViewLimiter.check(user.uid);
  if (!rateCheck.allowed) {
    throw new RateLimitedError('File access rate limit exceeded', rateCheck.retryAfter);
  }

  try {
    // 1. Resolve ownership (verifies mobile_attachments or legacy history)
    const resolved = await resolveFileOwnership(fileId, user);

    // 2. Fetch binary file from Appwrite Storage using server credentials
    const fileBuffer = await storage.getFileDownload(resolved.bucketId, resolved.fileId);
    const buffer = Buffer.from(fileBuffer);

    // 3. Set secure authenticated cache behavior & MIME headers
    res.setHeader('Content-Type', resolved.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(resolved.fileName)}"`
    );

    // 4. Stream binary body to client
    res.status(200).send(buffer);
  } catch (err: any) {
    logger.warn('Failed to retrieve mobile file:', {
      fileId,
      uid: user.uid,
      error: err.message,
    });
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.message || 'Failed to retrieve file',
      code: err.code || 'INTERNAL_ERROR',
    });
  }
});

fileRouter.delete('/file', requireFirebaseUser, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const fileId = (req.query.fileId as string) || (req.body?.fileId as string);

  if (!fileId) {
    throw new BadRequestError('Parameter "fileId" is required');
  }

  try {
    // 1. Resolve and verify ownership
    const resolved = await resolveFileOwnership(fileId, user);

    // 2. Delete file from Appwrite storage
    await storage.deleteFile(resolved.bucketId, resolved.fileId);

    // 3. Delete metadata from mobile_attachments
    await deleteAttachmentRecord(resolved.fileId);

    logger.info('Deleted file and ownership record:', { fileId, uid: user.uid });
    res.status(200).json({ success: true, fileId: resolved.fileId });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: err.message || 'Failed to delete file',
      code: err.code || 'INTERNAL_ERROR',
    });
  }
});
