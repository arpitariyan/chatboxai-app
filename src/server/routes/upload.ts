/**
 * src/server/routes/upload.ts
 *
 * POST /api/mobile/upload
 * Secure, authenticated mobile attachment upload.
 * Matches Master Specification Section 9.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { requireFirebaseUser } from '../lib/firebase-admin';
import { storage, STORAGE_BUCKET_ID, InputFile, Permission, Role } from '../lib/appwrite-admin';
import { createAttachmentRecord, cleanupOrphanFile } from '../lib/attachment-repository';
import { validateUploadedFile, MAX_FILE_SIZE } from '../lib/validation';
import { uploadLimiter } from '../lib/rate-limit';
import { RateLimitedError, BadRequestError } from '../lib/errors';
import { logger } from '../lib/logger';

export const uploadRouter = Router();

// Store uploads in memory for validation before passing to Appwrite
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

uploadRouter.post(
  '/upload',
  requireFirebaseUser,
  uploadMiddleware.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user!;
    const file = req.file;

    // Rate limiting check
    const rateCheck = uploadLimiter.check(user.uid, file?.size || 0);
    if (!rateCheck.allowed) {
      throw new RateLimitedError('Upload rate limit exceeded', rateCheck.retryAfter);
    }

    if (!file || !file.buffer) {
      throw new BadRequestError('No file provided in multipart request');
    }

    // Validate size, MIME, magic bytes, sanitize filename
    const { resolvedMime, cleanName } = await validateUploadedFile(
      file.buffer,
      file.mimetype,
      file.originalname
    );

    // Generate random 16-character alphanumeric ID for Appwrite fileId
    const serverFileId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex').slice(0, 32);

    logger.info('Uploading validated file to Appwrite storage:', {
      fileId: serverFileId,
      name: cleanName,
      mime: resolvedMime,
      bytes: file.buffer.length,
      uid: user.uid,
    });

    let storageUploaded = false;

    try {
      // 1. Upload to Appwrite Storage with server credentials
      const inputFile = InputFile.fromBuffer(file.buffer, cleanName);
      await storage.createFile(
        STORAGE_BUCKET_ID,
        serverFileId,
        inputFile,
        [
          Permission.read(Role.any()),
          Permission.write(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ]
      );
      storageUploaded = true;

      // 2. Create authoritative ownership record in mobile_attachments
      const record = await createAttachmentRecord({
        fileId: serverFileId,
        bucketId: STORAGE_BUCKET_ID,
        userId: user.uid,
        userEmail: user.email,
        fileName: cleanName,
        mimeType: resolvedMime,
        fileSize: file.buffer.length,
        createdAt: new Date().toISOString(),
        status: 'ready',
        checksum,
      });

      // 3. Return metadata ONLY (never return Appwrite view URL or admin keys)
      res.status(200).json({
        success: true,
        fileId: record.fileId,
        bucketId: record.bucketId,
        fileName: record.fileName,
        fileType: record.mimeType,
        fileSize: record.fileSize,
      });
    } catch (err: any) {
      // Orphan cleanup: if storage upload succeeded but DB registration failed, remove file
      if (storageUploaded) {
        await cleanupOrphanFile(serverFileId, STORAGE_BUCKET_ID);
      }
      logger.error('Failed to complete mobile upload:', {
        fileId: serverFileId,
        error: err.message,
      });
      res.status(err.statusCode || 500).json({
        error: err.message || 'File upload failed',
        code: err.code || 'INTERNAL_ERROR',
      });
    }
  }
);
