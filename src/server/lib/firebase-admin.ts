import './env';
import type { Request, Response, NextFunction } from 'express';
import { AuthRequiredError } from './errors';
import { logger } from './logger';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

const FIREBASE_LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';

const apiKey =
  process.env.FIREBASE_API_KEY ||
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  'AIzaSyC_-B_RZ43iw1Z4cHb-iGod44FLzxyWYdk';

/**
 * Extracts Bearer token from request Authorization header or custom header.
 */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization || (req.headers['Authorization'] as string) || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const customHeader = req.headers['x-firebase-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  return null;
}

/**
 * Safely decodes JWT payload without verifying signature (for preliminary expiration check).
 */
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

/**
 * Verifies Firebase ID token using Google Identity Toolkit accounts:lookup API.
 * 100% Serverless, Edge, and CommonJS compatible (no native dependencies or ESM conflicts).
 */
export async function verifyToken(idToken: string): Promise<AuthenticatedUser> {
  if (!idToken || typeof idToken !== 'string' || idToken.length < 50) {
    throw new AuthRequiredError('Missing or malformed authorization token');
  }

  // Pre-validate token expiration from JWT payload to reject expired tokens early
  const payload = decodeJwtPayload(idToken);
  if (payload?.exp && typeof payload.exp === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      throw new AuthRequiredError('Authentication token has expired');
    }
  }

  // Authoritative verification via Google Identity Toolkit REST API
  try {
    const lookupRes = await fetch(`${FIREBASE_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const data = (await lookupRes.json().catch(() => ({}))) as any;
    if (!lookupRes.ok || !data?.users?.[0]) {
      const errDetail = data?.error?.message || 'Token lookup rejected by Google Identity Toolkit';
      logger.warn('Token verification failed:', { error: errDetail });
      throw new AuthRequiredError('Invalid, expired, or revoked authentication token');
    }

    const u = data.users[0];
    const email = (u.email || payload?.email || '').trim().toLowerCase();
    const uid = String(u.localId || payload?.user_id || payload?.sub || '').trim();

    if (!uid) {
      throw new AuthRequiredError('Unable to resolve user identifier from token');
    }

    return {
      uid,
      email,
      emailVerified: !!u.emailVerified,
    };
  } catch (err: any) {
    if (err instanceof AuthRequiredError) throw err;
    logger.error('Google Identity Toolkit network error during token verification:', {
      error: err.message,
    });
    throw new AuthRequiredError('Authentication service temporarily unreachable');
  }
}

/**
 * Express middleware that enforces valid Firebase authentication on protected routes.
 */
export async function requireFirebaseUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthRequiredError('Bearer token is required');
    }

    const authUser = await verifyToken(token);
    req.user = authUser;
    next();
  } catch (err: any) {
    const status = err.statusCode || 401;
    res.status(status).json({
      error: err.message || 'Authentication required',
      code: err.code || 'AUTH_REQUIRED',
    });
  }
}
