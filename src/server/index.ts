import './lib/env';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Read .env if not already loaded into process.env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  });
}

import { logger } from './lib/logger';
import { formatErrorResponse } from './lib/errors';
import { ensureCollectionExists } from './lib/attachment-repository';

// Route modules
import { healthRouter } from './routes/health';
import { uploadRouter } from './routes/upload';
import { fileRouter } from './routes/file';
import { analyzeRouter } from './routes/analyze';
import { proxyRouter } from './routes/proxy';
import { imageRouter } from './routes/image';

const app = express();
const PORT = Number(process.env.PORT || process.env.MOBILE_API_PORT || 3001);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Attach unique requestId and log incoming requests
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`, {
      requestId,
      status: res.statusCode,
      durationMs,
      endpoint: req.originalUrl,
      uid: req.user?.uid,
    });
  });

  next();
});

// ── Root Endpoint ────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'chatboxai-mobile-api',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/api/mobile/health',
      upload: '/api/mobile/upload',
      file: '/api/mobile/file',
      analyze: '/api/mobile/analyze',
    },
  });
});

// ── Mount Mobile API Routes ──────────────────────────────────────────────────
app.use('/api/mobile', healthRouter);
app.use('/api/mobile', uploadRouter);
app.use('/api/mobile', fileRouter);
app.use('/api/mobile', analyzeRouter);
app.use('/api/mobile', proxyRouter);
app.use('/api/mobile', imageRouter);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const formatted = formatErrorResponse(err);
  logger.error('Unhandled route error:', {
    requestId: req.requestId,
    status: formatted.statusCode,
    error: (err as any)?.message || String(err),
  });

  if (formatted.headers) {
    for (const [k, v] of Object.entries(formatted.headers)) {
      res.setHeader(k, v);
    }
  }

  res.status(formatted.statusCode).json(formatted.body);
});

// ── Bootstrapping ────────────────────────────────────────────────────────────
export function startServer() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`ChatBox AI Mobile Backend running on http://0.0.0.0:${PORT}`);
    logger.info(`Endpoints:
  - GET  /api/mobile/health
  - POST /api/mobile/upload
  - GET  /api/mobile/file?fileId=<id>
  - DEL  /api/mobile/file?fileId=<id>
  - POST /api/mobile/analyze
  - GET  /api/mobile/conversations
  - GET  /api/mobile/conversations/:libId/chats`);

    // Asynchronously ensure mobile_attachments collection exists in Appwrite
    ensureCollectionExists().catch((err) => {
      logger.warn('Asynchronous collection initialization failed:', { error: err.message });
    });
  });

  return server;
}

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME
);

// Auto-start if run directly (and not inside Vercel Serverless)
if (!isServerless && (require.main === module || !process.env.JEST_WORKER_ID)) {
  startServer();
}

export default app;
