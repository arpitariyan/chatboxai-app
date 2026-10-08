/**
 * src/services/intelligence/semanticCache.ts
 *
 * Local Semantic Cache.
 * Speeds up response times and reduces compute for repeated, static queries.
 * Enforces per-user boundaries and skips caching for temporal/ephemeral queries.
 */

interface CacheEntry {
  key: string;
  response: string;
  thinking: string;
  intent: string;
  timestamp: number;
  ttlMs: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 50;

export class SemanticCache {
  private static cache = new Map<string, CacheEntry>();

  private static buildKey(userEmail: string, modelId: string, query: string): string {
    const normalizedQuery = query.trim().toLowerCase().replace(/[!?.,;]/g, '');
    return `${userEmail}::${modelId}::${normalizedQuery}`;
  }

  /**
   * Look up cached answer.
   */
  public static get(
    userEmail: string,
    modelId: string,
    query: string,
    isIncognito: boolean = false
  ): { response: string; thinking: string; intent: string } | null {
    if (isIncognito || !userEmail) return null;

    // Do not cache temporal/real-time queries
    if (/\b(today|now|current|latest|weather|time|date|stock|price)\b/i.test(query)) {
      return null;
    }

    const key = this.buildKey(userEmail, modelId, query);
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return {
      response: entry.response,
      thinking: entry.thinking,
      intent: entry.intent,
    };
  }

  /**
   * Save answer to cache.
   */
  public static set(
    userEmail: string,
    modelId: string,
    query: string,
    response: string,
    thinking: string,
    intent: string,
    isIncognito: boolean = false
  ): void {
    if (isIncognito || !userEmail || !response) return;

    // Do not cache temporal queries
    if (/\b(today|now|current|latest|weather|time|date|stock|price)\b/i.test(query)) {
      return;
    }

    const key = this.buildKey(userEmail, modelId, query);
    this.cache.set(key, {
      key,
      response,
      thinking,
      intent,
      timestamp: Date.now(),
      ttlMs: DEFAULT_TTL_MS,
    });

    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  public static clear(): void {
    this.cache.clear();
  }
}
