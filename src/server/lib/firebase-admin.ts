import './env';
import type { Request, Response, NextFunction } from 'express';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  'craetionai';

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (getApps().length === 0) {
  try {
    if (clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      logger.info('Firebase Admin initialized with service account credentials');
    } else {
      initializeApp({ projectId });
      logger.info('Firebase Admin initialized with project ID verification');
    }
  } catch (err: any) {
    logger.warn('Firebase Admin default init warning, will fallback to Identity Toolkit:', {
      error: err.message,
    });
  }
}

/**
 * Extracts Bearer token from request Authorization header.
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
 * Verifies Firebase ID token using Firebase Admin SDK or Google Identity Toolkit fallback.
 */
export async function verifyToken(idToken: string): Promise<AuthenticatedUser> {
  if (!idToken || typeof idToken !== 'string' || idToken.length < 50) {
    throw new AuthRequiredError('Missing or malformed authorization token');
  }

  // 1. Try Firebase Admin SDK verification
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (decoded && decoded.uid) {
      return {
        uid: decoded.uid,
        email: (decoded.email || '').trim().toLowerCase(),
        emailVerified: !!decoded.email_verified,
      };
    }
  } catch (adminErr: any) {
    logger.debug('Firebase Admin verifyIdToken skipped or failed, trying Identity Toolkit:', {
      error: adminErr.message,
    });
  }

  // 2. Fallback to Google Identity Toolkit accounts:lookup
  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyC_-B_RZ43iw1Z4cHb-iGod44FLzxyWYdk';

  const lookupRes = await fetch(`${FIREBASE_LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const payload = (await lookupRes.json().catch(() => ({}))) as any;
  if (!lookupRes.ok || !payload?.users?.[0]) {
    throw new AuthRequiredError('Invalid, expired, or revoked authentication token');
  }

  const u = payload.users[0];
  const email = (u.email || '').trim().toLowerCase();
  const uid = String(u.localId || '').trim();

  if (!uid) {
    throw new AuthRequiredError('Unable to resolve user identifier from token');
  }

  return {
    uid,
    email,
    emailVerified: !!u.emailVerified,
  };
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
