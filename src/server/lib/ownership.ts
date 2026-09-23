/**
 * src/server/lib/ownership.ts
 *
 * Authoritative ownership verification for new and legacy files.
 * Matches Master Specification Sections 7, 8, 30.
 */

import { findByFileId, createAttachmentRecord, MobileAttachmentRecord } from './attachment-repository';
import { databases, storage, DB_ID, LIBRARY_COLLECTION_ID, CHATS_COLLECTION_ID, STORAGE_BUCKET_ID, Query } from './appwrite-admin';
import { AuthenticatedUser } from './firebase-admin';
import { FileForbiddenError, FileNotFoundError } from './errors';
import { logger } from './logger';

export interface ResolvedFileContext {
  fileId: string;
  bucketId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  isLegacy: boolean;
}

/**
 * Resolves ownership of a requested fileId against the authenticated user.
 * 1. Checks mobile_attachments record (primary for new files).
 * 2. Checks historical storage bucket & backfills to mobile_attachments (legacy support).
 * 3. Throws FileForbiddenError if file belongs to another user.
 * 4. Throws FileNotFoundError if file is completely unknown.
 */
export async function resolveFileOwnership(
  fileId: string,
  user: AuthenticatedUser
): Promise<ResolvedFileContext> {
  const normalizedFileId = (fileId || '').trim();
  if (!normalizedFileId) {
    throw new FileNotFoundError('File ID is required');
  }

  // 1. Check primary mobile_attachments ownership record
  const record = await findByFileId(normalizedFileId);

  if (record) {
    const isOwner =
      record.userId === user.uid ||
      record.userEmail.toLowerCase() === user.email.toLowerCase();

    if (!isOwner) {
      logger.warn('Ownership check failed for mobile_attachments:', {
        fileId: normalizedFileId,
        recordOwner: record.userId,
        requestUid: user.uid,
      });
      throw new FileForbiddenError('File does not belong to this user');
    }

    return {
      fileId: record.fileId,
      bucketId: record.bucketId || STORAGE_BUCKET_ID,
      fileName: record.fileName,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      isLegacy: false,
    };
  }

  // 2. Legacy file support: check if file exists in Appwrite Storage bucket
  logger.info('File not found in mobile_attachments, checking Appwrite Storage:', {
    fileId: normalizedFileId,
    email: user.email,
  });

  try {
    const storageFile = await storage.getFile(STORAGE_BUCKET_ID, normalizedFileId);
    if (storageFile) {
      // Auto-backfill to mobile_attachments so subsequent requests hit the primary record
      try {
        await createAttachmentRecord({
          fileId: normalizedFileId,
          bucketId: STORAGE_BUCKET_ID,
          userId: user.uid,
          userEmail: user.email.toLowerCase(),
          fileName: storageFile.name || normalizedFileId,
          mimeType: storageFile.mimeType || 'application/octet-stream',
          fileSize: storageFile.sizeOriginal || 0,
          status: 'ready',
          createdAt: storageFile.$createdAt || new Date().toISOString(),
        });
        logger.info('Backfilled legacy file into mobile_attachments:', {
          fileId: normalizedFileId,
          uid: user.uid,
        });
      } catch (backfillErr: any) {
        // Non-fatal if index or doc collision occurs
      }

      return {
        fileId: normalizedFileId,
        bucketId: STORAGE_BUCKET_ID,
        fileName: storageFile.name || normalizedFileId,
        mimeType: storageFile.mimeType || 'application/octet-stream',
        fileSize: storageFile.sizeOriginal,
        isLegacy: true,
      };
    }
  } catch (storageErr: any) {
    logger.debug('File not found in Appwrite Storage:', {
      error: storageErr.message,
      fileId: normalizedFileId,
    });
  }

  // File was not found
  throw new FileNotFoundError(`File "${normalizedFileId}" not found or access denied`);
}
