/**
 * src/server/lib/errors.ts
 *
 * Structured error classes and error response builder.
 * Matches Master Specification Section 33 Error Contract.
 */

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FILE_FORBIDDEN'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly retryAfter?: number;

  constructor(message: string, statusCode: number, code: ErrorCode, retryAfter?: number) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthRequiredError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
  }
}

export class FileForbiddenError extends AppError {
  constructor(message = 'File does not belong to this user') {
    super(message, 403, 'FILE_FORBIDDEN');
  }
}

export class FileNotFoundError extends AppError {
  constructor(message = 'File not found') {
    super(message, 404, 'FILE_NOT_FOUND');
  }
}

export class FileTooLargeError extends AppError {
  constructor(message = 'File too large') {
    super(message, 413, 'FILE_TOO_LARGE');
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(message = 'Unsupported file format or type') {
    super(message, 400, 'UNSUPPORTED_MEDIA');
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = 60) {
    super(message, 429, 'RATE_LIMITED', retryAfter);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request parameters') {
    super(message, 400, 'BAD_REQUEST');
  }
}

export function formatErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: {
        error: err.message,
        code: err.code,
      },
      headers: err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : undefined,
    };
  }

  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  return {
    statusCode: 500,
    body: {
      error: 'An internal server error occurred',
      code: 'INTERNAL_ERROR' as ErrorCode,
    },
  };
}
