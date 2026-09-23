/**
 * src/server/lib/logger.ts
 *
 * Safe structured server logger.
 * Invariants:
 * - NEVER log API keys, Firebase private keys, or passwords.
 * - NEVER log raw Authorization headers or full token strings.
 * - NEVER log base64 data URIs or file binary buffers.
 * - Every log entry includes timestamp, level, and optional requestId.
 */

export interface LogMeta {
  requestId?: string;
  uid?: string;
  email?: string;
  fileId?: string;
  endpoint?: string;
  status?: number;
  durationMs?: number;
  error?: string;
  code?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'key',
  'apikey',
  'secret',
  'password',
  'privatekey',
  'private_key',
  'data',
  'base64',
]);

function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lower = k.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lower)) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.startsWith('data:')) {
      clean[k] = '[DATA_URI_REDACTED]';
    } else if (typeof v === 'string' && v.length > 500) {
      clean[k] = `${v.slice(0, 100)}... [truncated ${v.length} chars]`;
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitize(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    const payload = meta ? ` ${JSON.stringify(sanitize(meta))}` : '';
    console.log(`[${new Date().toISOString()}] [INFO] ${message}${payload}`);
  },

  warn(message: string, meta?: LogMeta) {
    const payload = meta ? ` ${JSON.stringify(sanitize(meta))}` : '';
    console.warn(`[${new Date().toISOString()}] [WARN] ${message}${payload}`);
  },

  error(message: string, meta?: LogMeta) {
    const payload = meta ? ` ${JSON.stringify(sanitize(meta))}` : '';
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}${payload}`);
  },

  debug(message: string, meta?: LogMeta) {
    if (process.env.NODE_ENV !== 'production') {
      const payload = meta ? ` ${JSON.stringify(sanitize(meta))}` : '';
      console.debug(`[${new Date().toISOString()}] [DEBUG] ${message}${payload}`);
    }
  },
};
