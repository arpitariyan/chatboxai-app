/**
 * api/index.ts
 *
 * Vercel Serverless Function entrypoint.
 * Routes all incoming requests directly into the Express application.
 */

import app from '../src/server/index';

export default function handler(req: any, res: any) {
  return (app as any)(req, res);
}

