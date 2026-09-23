/**
 * src/server/lib/rate-limit.ts
 *
 * In-memory sliding window rate limiter.
 * Gated per authenticated user ID (or IP as fallback).
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxBytes?: number;
}

interface WindowRecord {
  timestamps: number[];
  bytesTransferred: number;
}

class SlidingWindowLimiter {
  private windows = new Map<string, WindowRecord>();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Periodic cleanup of stale buckets every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.windows.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < this.config.windowMs);
        if (record.timestamps.length === 0) {
          this.windows.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  public check(key: string, bytes = 0): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    let record = this.windows.get(key);

    if (!record) {
      record = { timestamps: [], bytesTransferred: 0 };
      this.windows.set(key, record);
    }

    // Filter out timestamps outside window
    record.timestamps = record.timestamps.filter((t) => now - t < this.config.windowMs);

    // Reset bytes if all timestamps expired
    if (record.timestamps.length === 0) {
      record.bytesTransferred = 0;
    }

    // Check request count limit
    if (record.timestamps.length >= this.config.maxRequests) {
      const oldest = record.timestamps[0] || now;
      const retryAfter = Math.ceil((oldest + this.config.windowMs - now) / 1000);
      return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }

    // Check byte limit if configured
    if (this.config.maxBytes && record.bytesTransferred + bytes > this.config.maxBytes) {
      const oldest = record.timestamps[0] || now;
      const retryAfter = Math.ceil((oldest + this.config.windowMs - now) / 1000);
      return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }

    // Record request
    record.timestamps.push(now);
    record.bytesTransferred += bytes;
    return { allowed: true };
  }
}

// 30 uploads / hour per user, max 150MB / hour
export const uploadLimiter = new SlidingWindowLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  maxBytes: 150 * 1024 * 1024,
});

// 60 analyses / hour per user
export const analyzeLimiter = new SlidingWindowLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 60,
});

// 300 file views / hour per user
export const fileViewLimiter = new SlidingWindowLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 300,
});
