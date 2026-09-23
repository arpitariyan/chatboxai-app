/**
 * src/server/routes/health.ts
 *
 * GET /api/mobile/health
 * Public health probe.
 * Matches Master Specification Section 35.
 */

import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'chatboxai-mobile-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
