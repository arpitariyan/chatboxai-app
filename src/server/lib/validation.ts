/**
 * src/server/lib/validation.ts
 *
 * File size, MIME, magic-bytes, and filename sanitization.
 * Matches Master Specification Section 10.
 */

import { fileTypeFromBuffer } from 'file-type';
import { UnsupportedMediaError, FileTooLargeError, BadRequestError } from './errors';

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/svg+xml',

  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'application/json',

  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/x-wav',

  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/ogg',
]);

const TEXT_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'application/json',
]);

/**
 * Sanitizes original filename to prevent path traversal or filesystem attacks.
 */
export function sanitizeFileName(name?: string): string {
  if (!name) return `attachment_${Date.now()}.bin`;
  // Remove path traversal & control characters
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  const cleaned = base.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  return (cleaned || `attachment_${Date.now()}.bin`).slice(0, 180);
}

/**
 * Validates file buffer, declared MIME, and detected binary signature.
 */
export async function validateUploadedFile(
  buffer: Buffer,
  declaredMime: string,
  fileName: string
): Promise<{ valid: boolean; resolvedMime: string; cleanName: string }> {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestError('Uploaded file is zero bytes');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new FileTooLargeError(`File size ${buffer.length} exceeds limit of ${MAX_FILE_SIZE} bytes`);
  }

  const cleanName = sanitizeFileName(fileName);
  const normalizedDeclared = (declaredMime || '').trim().toLowerCase();

  // Try detecting magic bytes
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
      throw new UnsupportedMediaError(
        `Detected file type "${detected.mime}" is not an authorized attachment type`
      );
    }
    return {
      valid: true,
      resolvedMime: detected.mime,
      cleanName,
    };
  }

  // If file-type could not detect magic bytes, check if it's an allowed text-based type
  if (TEXT_TYPES.has(normalizedDeclared)) {
    // Validate text buffer doesn't contain null bytes (binary executables disguised as text)
    const hasNullBytes = buffer.slice(0, Math.min(buffer.length, 1024)).includes(0x00);
    if (hasNullBytes) {
      throw new UnsupportedMediaError('File contains binary null bytes, rejecting as text');
    }
    return {
      valid: true,
      resolvedMime: normalizedDeclared,
      cleanName,
    };
  }

  // If declared MIME is in allowed set and file size is reasonable
  if (ALLOWED_MIME_TYPES.has(normalizedDeclared)) {
    return {
      valid: true,
      resolvedMime: normalizedDeclared,
      cleanName,
    };
  }

  throw new UnsupportedMediaError(
    `Unsupported file type "${declaredMime}". Allowed formats: Images, PDFs, Documents, Audio, Video.`
  );
}
