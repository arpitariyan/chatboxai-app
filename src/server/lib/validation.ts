/**
 * src/server/lib/validation.ts
 *
 * File size, MIME, magic-bytes, and filename sanitization.
 * Matches Master Specification Section 10.
 */

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
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
  'text/markdown',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
  'application/zip',
  'application/x-zip-compressed',

  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/x-wav',
  'audio/m4a',

  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/ogg',
  'video/3gpp',
]);

const TEXT_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
  'text/markdown',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
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
 * Detects common file types by inspecting magic bytes without external ESM dependencies.
 */
export function detectMagicBytes(buffer: Buffer, fileName = ''): { ext: string; mime: string } | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { ext: 'gif', mime: 'image/gif' };
  }

  // RIFF container (WebP, WAV, AVI)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  ) {
    const subType = buffer.toString('ascii', 8, 12);
    if (subType === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
    if (subType === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
    if (subType === 'AVI ') return { ext: 'avi', mime: 'video/x-msvideo' };
  }

  // PDF: %PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { ext: 'pdf', mime: 'application/pdf' };
  }

  // BMP: BM
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return { ext: 'bmp', mime: 'image/bmp' };
  }

  // MP4 / MOV / QuickTime / M4A: bytes 4..7 === 'ftyp'
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.length >= 12 ? buffer.toString('ascii', 8, 12) : '';
    if (brand.startsWith('M4A ') || brand.startsWith('m4a')) {
      return { ext: 'm4a', mime: 'audio/mp4' };
    }
    if (brand.startsWith('qt')) {
      return { ext: 'mov', mime: 'video/quicktime' };
    }
    return { ext: 'mp4', mime: 'video/mp4' };
  }

  // MP3: ID3 header or frame sync 0xFF FB/F3/F2
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }

  // OGG: OggS
  if (
    buffer[0] === 0x4f &&
    buffer[1] === 0x67 &&
    buffer[2] === 0x67 &&
    buffer[3] === 0x53
  ) {
    return { ext: 'ogg', mime: 'audio/ogg' };
  }

  // FLAC: fLaC
  if (
    buffer[0] === 0x66 &&
    buffer[1] === 0x4c &&
    buffer[2] === 0x43 &&
    buffer[3] === 0x43
  ) {
    return { ext: 'flac', mime: 'audio/flac' };
  }

  // WebM / Matroska: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { ext: 'webm', mime: 'video/webm' };
  }

  // ZIP / OpenXML (docx, pptx, xlsx, zip): PK \x03 \x04
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    const fileExt = (fileName.split('.').pop() || '').toLowerCase();
    if (fileExt === 'pptx') {
      return {
        ext: 'pptx',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };
    }
    if (fileExt === 'xlsx') {
      return {
        ext: 'xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    if (fileExt === 'zip') {
      return {
        ext: 'zip',
        mime: 'application/zip',
      };
    }
    return {
      ext: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  return null;
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

  // Try detecting magic bytes with filename extension context
  const detected = detectMagicBytes(buffer, cleanName);

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
