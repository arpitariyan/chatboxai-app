/**
 * api/index.ts
 *
 * Vercel Serverless Function entrypoint.
 * Routes all incoming requests directly into the Express application.
 */

let app: any = null;
let initError: any = null;

try {
  // Synchronously load Express application
  const mod = require('../src/server/index');
  app = mod.default || mod;
} catch (err: any) {
  initError = err;
  console.error('Fatal initialization error in API entrypoint:', err);
}

export default function handler(req: any, res: any) {
  if (initError) {
    return res.status(500).json({
      ok: false,
      error: 'API_INITIALIZATION_FAILED',
      message: initError?.message || String(initError),
      stack: initError?.stack,
    });
  }

  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Runtime error in request handler:', err);
    return res.status(500).json({
      ok: false,
      error: 'REQUEST_DISPATCH_FAILED',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
}

// Ensure both CJS and ESM consumers can execute handler
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}
