/**
 * src/server/lib/attachment-repository.ts
 *
 * Repository for mobile_attachments Appwrite collection.
 * Matches Master Specification Section 7.
 */

import {
  databases,
  storage,
  DB_ID,
  STORAGE_BUCKET_ID,
  MOBILE_ATTACHMENTS_COLLECTION_ID,
  ID,
  Query,
  Permission,
  Role,
} from './appwrite-admin';
import { logger } from './logger';

export interface MobileAttachmentRecord {
  fileId: string;
  bucketId: string;
  userId: string;
  userEmail: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  status: 'ready' | 'processing' | 'error';
  checksum?: string;
  $id?: string;
}

let collectionInitialized = false;

/**
 * Ensures mobile_attachments collection exists with all required attributes and indexes.
 */
export async function ensureCollectionExists(): Promise<void> {
  if (collectionInitialized) return;

  try {
    // Check if collection already exists
    await databases.getCollection(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID);
    collectionInitialized = true;
    logger.info('Collection mobile_attachments verified');
    return;
  } catch (err: any) {
    if (err?.code !== 404 && !String(err?.message || '').includes('could not be found')) {
      logger.warn('Unexpected error checking mobile_attachments collection:', { error: err.message });
      return;
    }
  }

  try {
    logger.info('Creating mobile_attachments collection in Appwrite...');
    await databases.createCollection(
      DB_ID,
      MOBILE_ATTACHMENTS_COLLECTION_ID,
      'mobile_attachments',
      [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]
    );

    // Create string attributes
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'fileId', 255, true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'bucketId', 255, true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'userId', 255, true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'userEmail', 255, true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'fileName', 255, true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'mimeType', 255, true);
    await databases.createIntegerAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'fileSize', true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'createdAt', 64, true);
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'status', 64, false, 'ready');
    await databases.createStringAttribute(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, 'checksum', 64, false, '');

    // Allow Appwrite a moment to apply attributes before creating indexes
    await new Promise((r) => setTimeout(r, 2000));

    try {
      await databases.createIndex(
        DB_ID,
        MOBILE_ATTACHMENTS_COLLECTION_ID,
        'idx_mobile_att_fileId',
        'key' as any,
        ['fileId']
      );
      await databases.createIndex(
        DB_ID,
        MOBILE_ATTACHMENTS_COLLECTION_ID,
        'idx_mobile_att_userId',
        'key' as any,
        ['userId']
      );
      await databases.createIndex(
        DB_ID,
        MOBILE_ATTACHMENTS_COLLECTION_ID,
        'idx_mobile_att_createdAt',
        'key' as any,
        ['createdAt']
      );
    } catch (idxErr: any) {
      logger.warn('Non-fatal error creating indexes for mobile_attachments:', { error: idxErr.message });
    }

    collectionInitialized = true;
    logger.info('Collection mobile_attachments successfully created and configured');
  } catch (createErr: any) {
    logger.error('Failed to create mobile_attachments collection:', { error: createErr.message });
  }
}

/**
 * Creates an authoritative ownership record for a newly uploaded mobile attachment.
 */
export async function createAttachmentRecord(
  data: Omit<MobileAttachmentRecord, '$id'>
): Promise<MobileAttachmentRecord> {
  await ensureCollectionExists();

  const payload = {
    fileId: data.fileId,
    bucketId: data.bucketId || STORAGE_BUCKET_ID,
    userId: data.userId,
    userEmail: data.userEmail.toLowerCase().trim(),
    fileName: data.fileName,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    createdAt: data.createdAt || new Date().toISOString(),
    status: data.status || 'ready',
    checksum: data.checksum || '',
  };

  const doc = await databases.createDocument(
    DB_ID,
    MOBILE_ATTACHMENTS_COLLECTION_ID,
    ID.unique(),
    payload
  );

  return doc as unknown as MobileAttachmentRecord;
}

/**
 * Finds an attachment ownership record by fileId.
 */
export async function findByFileId(fileId: string): Promise<MobileAttachmentRecord | null> {
  await ensureCollectionExists();

  try {
    const res = await databases.listDocuments(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, [
      Query.equal('fileId', fileId),
      Query.limit(1),
    ]);

    if (res.documents && res.documents.length > 0) {
      return res.documents[0] as unknown as MobileAttachmentRecord;
    }
  } catch (err: any) {
    logger.warn('Error querying mobile_attachments by fileId:', { fileId, error: err.message });
  }

  return null;
}

/**
 * Deletes attachment record from mobile_attachments by fileId.
 */
export async function deleteAttachmentRecord(fileId: string): Promise<boolean> {
  await ensureCollectionExists();

  try {
    const record = await findByFileId(fileId);
    if (record?.$id) {
      await databases.deleteDocument(DB_ID, MOBILE_ATTACHMENTS_COLLECTION_ID, record.$id);
      return true;
    }
  } catch (err: any) {
    logger.warn('Error deleting attachment record:', { fileId, error: err.message });
  }

  return false;
}

/**
 * Cleanup orphan file from Appwrite Storage if database registration failed.
 */
export async function cleanupOrphanFile(fileId: string, bucketId: string = STORAGE_BUCKET_ID): Promise<void> {
  try {
    await storage.deleteFile(bucketId, fileId);
    logger.info('Cleaned up orphan storage file', { fileId, bucketId });
  } catch (err: any) {
    logger.warn('Failed to cleanup orphan storage file:', { fileId, error: err.message });
  }
}
