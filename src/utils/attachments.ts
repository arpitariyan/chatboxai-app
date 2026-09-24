/**
 * src/utils/attachments.ts
 *
 * Single source of truth for chat attachments.
 *
 * INVARIANTS
 *  1. The DB (chats.processedFiles) only ever holds StoredAttachment: six
 *     server-side keys. It is the SAME shape the website reads, so do not add
 *     or rename keys here without checking chatboxai_website_copy.
 *  2. Bytes (base64 / file:// / content:// / blob:) never reach the DB or the
 *     /api/analyze request body. They live on-device only.
 *  3. Display never depends on a single URL: resolveAttachment() returns an
 *     ordered candidate list and <AttachmentImage> walks it on error.
 *
 * Why a WHITELIST: the old fix deleted `uri` and `data` (blacklist). Any new
 * field added later leaks straight into the DB. A whitelist cannot leak.
 */

export interface StoredAttachment {
  fileId: string;
  path: string;
  publicUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  bucketId?: string;
}

export interface AppwriteUrlConfig {
  endpoint: string; // e.g. https://nyc.cloud.appwrite.io/v1
  projectId: string;
  bucketId: string;
}

export const MAX_ATTACHMENTS = 20;
/** 20 x ~400 chars is ~8k. 32k is generous but still catches smuggled payloads. */
export const MAX_SERIALIZED_CHARS = 32000;

const DATA_URI_RE = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i;
const LOCAL_URI_RE = /(?:file|content|blob|ph|assets-library):\/\//i;
const BASE64_RUN_RE = /[A-Za-z0-9+/]{2000,}={0,2}/;
const HTTP_RE = /^https?:\/\//i;

type Loose = Record<string, unknown>;

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;

const asNumber = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

function parseStorageUrl(url?: string): { bucketId: string; fileId: string } | undefined {
  if (!url) return undefined;
  const m = /\/storage\/buckets\/([^/?#]+)\/files\/([^/?#]+)/.exec(url);
  if (!m || !m[1] || !m[2]) return undefined;
  return { bucketId: m[1], fileId: m[2] };
}

/** Removes console-only params (mode=admin, impersonateuserid) that 401 outside the Appwrite Console. */
export function stripAdminParams(url: string): string {
  const i = url.indexOf('?');
  if (i < 0) return url;
  const kept = url
    .slice(i + 1)
    .split('&')
    .filter((p) => p && !/^(mode|impersonateuserid)=/i.test(p));
  return url.slice(0, i) + (kept.length ? `?${kept.join('&')}` : '');
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/**
 * Accepts any loose shape (upload response, legacy DB row, UI object) and
 * returns the compact persisted form, or null if the file was never uploaded.
 */
export function toStoredAttachment(raw: unknown): StoredAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Loose;

  const pub = asString(r.publicUrl) ?? asString(r.url) ?? asString(r.fileUrl);
  const fromUrl = parseStorageUrl(pub);
  const fileId =
    asString(r.fileId) ?? asString(r.path) ?? asString(r.$id) ?? fromUrl?.fileId;
  // No id means it was never uploaded. Never fall back to a local uri / base64.
  if (!fileId) return null;

  const bucketId = asString(r.bucketId) ?? fromUrl?.bucketId;

  const typeField = asString(r.type);
  const fileType =
    asString(r.fileType) ??
    asString(r.mimeType) ??
    asString(r.mime) ??
    (typeField?.includes('/') ? typeField : undefined) ??
    'application/octet-stream';

  // Sanitize publicUrl: Never store or retain raw Appwrite storage URLs as publicUrl
  // because direct Appwrite storage access requires private server authentication.
  const isDirectAppwrite = pub && (pub.includes('appwrite.io') || pub.includes('/storage/buckets/'));
  const safePublicUrl = pub && HTTP_RE.test(pub) && !isDirectAppwrite ? pub : '';

  return {
    fileId,
    path: asString(r.path) ?? fileId,
    publicUrl: safePublicUrl,
    fileName: (asString(r.fileName) ?? asString(r.name) ?? fileId).slice(0, 200),
    fileType,
    fileSize: asNumber(r.fileSize) ?? asNumber(r.size),
    ...(bucketId ? { bucketId } : {}),
  };
}

/** Throws if a serialized attachments string contains bytes or local URIs, or is oversized. */
export function assertDbSafe(json: string, label = 'processedFiles'): void {
  if (DATA_URI_RE.test(json)) {
    throw new Error(`[attachments] ${label}: base64 data URI detected, refusing to persist`);
  }
  if (LOCAL_URI_RE.test(json)) {
    throw new Error(`[attachments] ${label}: local URI (file/content/blob) detected, refusing to persist`);
  }
  if (json.length > MAX_SERIALIZED_CHARS) {
    throw new Error(`[attachments] ${label}: ${json.length} chars exceeds cap ${MAX_SERIALIZED_CHARS}`);
  }
}

/** The ONLY function that should produce the `processedFiles` column value. */
export function serializeAttachmentsForDb(raw: unknown): string {
  const list: unknown[] = Array.isArray(raw) ? raw : [];
  if (list.length > MAX_ATTACHMENTS) {
    throw new Error(`[attachments] ${list.length} attachments exceeds max ${MAX_ATTACHMENTS}`);
  }
  const stored = list
    .map((a) => toStoredAttachment(a))
    .filter((a): a is StoredAttachment => a !== null);
  const json = JSON.stringify(stored);
  assertDbSafe(json);
  return json;
}

/** Tolerant reader for DB rows (current shape, older/website shapes, or an already-parsed array). */
export function parseStoredAttachments(input: unknown): StoredAttachment[] {
  let value: unknown = input;
  if (typeof input === 'string') {
    if (!input.trim()) return [];
    try {
      value = JSON.parse(input);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((a) => toStoredAttachment(a)).filter((a): a is StoredAttachment => a !== null);
}

/**
 * Choke-point guard: call on EVERY createDocument/updateDocument payload.
 * Catches base64 sneaking into any column, now or from a future code path.
 */
export function assertNoBinaryPayload(payload: unknown, path = 'document'): void {
  if (typeof payload === 'string') {
    if (DATA_URI_RE.test(payload)) throw new Error(`[persist] ${path} contains a base64 data URI`);
    if (BASE64_RUN_RE.test(payload)) throw new Error(`[persist] ${path} contains a long base64-like run`);
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((v, i) => assertNoBinaryPayload(v, `${path}[${i}]`));
    return;
  }
  if (payload && typeof payload === 'object') {
    for (const [k, v] of Object.entries(payload as Loose)) assertNoBinaryPayload(v, `${path}.${k}`);
  }
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

/**
 * Plain Appwrite file URL from ids. Deliberately NO `mode=admin` (Console-session
 * only). The file must be readable by the client (Role.any() on the file or
 * bucket), otherwise this 401s. Built by hand: RN's URLSearchParams.toString()
 * is unreliable.
 */
export function attachmentUrl(
  att: { fileId: string; bucketId: string },
  cfg: Pick<AppwriteUrlConfig, 'endpoint' | 'projectId'>,
  thumb?: { width: number; height?: number; quality?: number },
): string {
  const base =
    `${cfg.endpoint.replace(/\/+$/, '')}/storage/buckets/${encodeURIComponent(att.bucketId)}` +
    `/files/${encodeURIComponent(att.fileId)}`;
  const project = `project=${encodeURIComponent(cfg.projectId)}`;
  if (!thumb) return `${base}/view?${project}`;
  const h = thumb.height ? `&height=${thumb.height}` : '';
  return `${base}/preview?${project}&width=${thumb.width}${h}&quality=${thumb.quality ?? 70}`;
}

import { toMobileFileUrl } from '@/config/mobileApi';

/**
 * Builds the canonical secure, authenticated mobile file retrieval URL.
 * Server resolves bucketId and ownership automatically from fileId.
 */
export function toMobileFileViewUrl(fileId: string, _bucketId?: string): string {
  return toMobileFileUrl(fileId);
}

/**
 * Ordered list of URLs to try for one attachment:
 *   1. local file:// / content:// uri   (instant, active session)
 *   2. local base64 preview             (instant fallback, active session)
 *   3. canonical authenticated mobile /file endpoint (server-authorized with Firebase token)
 */
export function attachmentCandidates(
  file: unknown,
  _cfg?: Partial<AppwriteUrlConfig>,
  _thumb?: { width: number; height?: number; quality?: number },
): string[] {
  const f = (file && typeof file === 'object' ? file : {}) as Loose;
  const out: string[] = [];
  const push = (u?: string) => {
    if (!u) return;
    const clean = stripAdminParams(u.trim());
    if (clean && !out.includes(clean)) out.push(clean);
  };

  // 1. Current-session local file uri (file://, content://, ph://, etc.)
  const uri = asString(f.uri);
  if (uri && (LOCAL_URI_RE.test(uri) || /^(?:file|content|ph|assets-library):\/\//i.test(uri))) {
    push(uri);
  }

  // 2. Current-session base64 data preview
  const data = asString(f.data);
  if (data && (data.startsWith('data:image/') || data.startsWith('data:'))) {
    push(data);
  }

  // 3. Extract canonical fileId from all candidate fields or parsed storage URLs
  const pub = asString(f.publicUrl) ?? asString(f.url) ?? asString(f.fileUrl);
  const fromUrl = parseStorageUrl(pub);
  const fileId = asString(f.fileId) ?? asString(f.path) ?? asString(f.$id) ?? fromUrl?.fileId;

  // 4. Primary remote candidate: Canonical authenticated mobile /file endpoint
  // Built using current runtime MOBILE_API_URL so it works in both dev & prod APK,
  // preventing stale local dev IPs from breaking production APKs.
  if (fileId) {
    push(toMobileFileUrl(fileId));
  }

  // 5. Fallback: stored URL only if it is an external web/CDN URL (e.g. Unsplash, imgur)
  // Strictly EXCLUDE direct Appwrite storage URLs (nyc.cloud.appwrite.io) as they require
  // private server authentication and will 401 when accessed directly by client.
  if (pub && HTTP_RE.test(pub)) {
    const isAppwriteStorage = pub.includes('appwrite.io') || pub.includes('/storage/buckets/');
    const isLocalDevIp = /(?:localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):3001/.test(pub);
    if (!isAppwriteStorage && (__DEV__ || !isLocalDevIp)) {
      push(pub);
    }
  }

  // Final safety filter: strictly exclude any direct Appwrite storage URLs
  return out.filter(
    (u) =>
      !u.includes('appwrite.io') &&
      !u.includes('/storage/buckets/')
  );
}

/** Everything ChatBubble needs for one attachment. */
export function resolveAttachment(
  file: unknown,
  cfg?: Partial<AppwriteUrlConfig>,
): { candidates: string[]; displayName: string; isImage: boolean; mimeType: string } {
  const f = (file && typeof file === 'object' ? file : {}) as Loose;
  const displayName = asString(f.fileName) ?? asString(f.name) ?? 'Document';
  const mimeType = asString(f.fileType) ?? asString(f.mimeType) ?? asString(f.mime) ?? '';
  const isImage =
    f.type === 'image' ||
    mimeType.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(displayName);
  return { candidates: attachmentCandidates(f, cfg), displayName, isImage, mimeType };
}
