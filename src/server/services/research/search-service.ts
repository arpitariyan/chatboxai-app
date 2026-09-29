/**
 * src/server/services/research/search-service.ts
 *
 * Multi-Search Engine for Deep Research:
 * - 6-key Tavily API rotation with automatic failover
 * - DuckDuckGo fallback for fast/free searches
 * - 6-hour Appwrite Search Cache
 * - Query complexity routing
 */

import axios from 'axios';
import { databases, DB_ID, ID, Query } from '../../lib/appwrite-admin';
import {
  SEARCH_CACHE_COLLECTION_ID,
  SEARCH_USAGE_COLLECTION_ID,
} from '../../lib/appwrite-admin';
import {
  computeComplexityScore,
  needsSearch,
  canonicalizeUrl,
  calculateSourceQualityScore,
  SourceQualityResult,
} from './search-utils';
import { logger } from '../../lib/logger';

// ── Tavily Keys Pool ─────────────────────────────────────────────────────────
const TAVILY_KEYS = [
  process.env.TAVILY_API_KEY,
  process.env.TAVILY_API_KEY2,
  process.env.TAVILY_API_KEY3,
  process.env.TAVILY_API_KEY4,
  process.env.TAVILY_API_KEY5,
  process.env.TAVILY_API_KEY6,
  process.env.TAVILY_API_KEY_1,
  process.env.TAVILY_API_KEY_2,
  process.env.TAVILY_API_KEY_3,
  process.env.TAVILY_API_KEY_4,
  process.env.TAVILY_API_KEY_5,
  process.env.TAVILY_API_KEY_6,
].filter((k): k is string => Boolean(k && k.trim().length > 5));

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface SearchResultItem {
  id?: number;
  title: string;
  url: string;
  description: string;
  content?: string;
  displayLink?: string;
  qualityScore?: number;
  qualityBand?: 'high' | 'medium' | 'low';
  sourceHost?: string;
  deepResearch?: boolean;
}

export interface DeepSearchExecutionResult {
  success: boolean;
  sources: SearchResultItem[];
  sourceUsed: 'cache' | 'tavily' | 'duckduckgo' | 'bypassed' | 'none';
  isComplex: boolean;
  useDirectModel?: boolean;
  creditsConsumed: number;
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── 6-Hour Appwrite Search Cache ─────────────────────────────────────────────
export async function getCachedSearchResult(query: string): Promise<SearchResultItem[] | null> {
  const normalized = normalizeQuery(query);
  try {
    const response = await databases.listDocuments(DB_ID, SEARCH_CACHE_COLLECTION_ID, [
      Query.equal('query', normalized),
      Query.limit(1),
    ]);
    if (response.documents.length > 0) {
      const doc = response.documents[0];
      const now = Date.now();
      const createdAt = new Date(doc.$createdAt).getTime();
      if (now - createdAt < CACHE_TTL_MS) {
        const parsed = JSON.parse(doc.results);
        return parsed.sources || parsed;
      }
    }
  } catch (err: any) {
    logger.warn('Cache lookup skipped or failed in Appwrite:', { error: err.message });
  }
  return null;
}

export async function setCachedSearchResult(query: string, sources: SearchResultItem[]): Promise<void> {
  const normalized = normalizeQuery(query);
  try {
    await databases.createDocument(DB_ID, SEARCH_CACHE_COLLECTION_ID, ID.unique(), {
      query: normalized,
      results: JSON.stringify({ sources }),
    });
  } catch (err: any) {
    logger.warn('Cache write failed in Appwrite:', { error: err.message });
  }
}

// ── Search Usage Logging ─────────────────────────────────────────────────────
export async function logSearchUsage(
  query: string,
  source: string,
  credits: number,
  score: number,
  fallbackReason: string | null = null
): Promise<void> {
  try {
    await databases.createDocument(DB_ID, SEARCH_USAGE_COLLECTION_ID, ID.unique(), {
      query,
      source,
      credits_consumed: credits,
      complexity_score: score,
      fallback_reason: fallbackReason,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.warn('Failed to log search usage in Appwrite:', { error: err.message });
  }
}

// ── Tavily API Rotation Search ───────────────────────────────────────────────
export async function executeTavilySearch(
  query: string,
  options: { searchDepth?: 'basic' | 'advanced'; maxResults?: number } = {}
): Promise<SearchResultItem[]> {
  if (TAVILY_KEYS.length === 0) {
    throw new Error('No Tavily API keys configured on backend');
  }

  const depth = options.searchDepth || 'basic';
  const maxResults = options.maxResults || 10;
  let lastError: any = null;

  for (let i = 0; i < TAVILY_KEYS.length; i++) {
    const key = TAVILY_KEYS[i];
    try {
      const response = await axios.post(
        'https://api.tavily.com/search',
        {
          api_key: key,
          query,
          search_depth: depth,
          include_answer: true,
          max_results: maxResults,
        },
        {
          timeout: 25000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const items = response.data?.results || [];
      return items.map((r: any) => ({
        title: r.title || 'Untitled',
        url: canonicalizeUrl(r.url),
        description: r.content || r.snippet || '',
        content: r.content || '',
        displayLink: r.url ? new URL(r.url).hostname.replace(/^www\./, '') : '',
      }));
    } catch (err: any) {
      logger.warn(`Tavily key ${i + 1}/${TAVILY_KEYS.length} failed:`, {
        error: err.response?.data?.detail || err.message,
      });
      lastError = err;
      // Continue to next key
    }
  }

  throw lastError || new Error('All Tavily API keys exhausted');
}

// ── DuckDuckGo HTML Fallback Search ──────────────────────────────────────────
export async function executeDuckDuckGoSearch(query: string): Promise<SearchResultItem[]> {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const html = String(response.data || '');
    const results: SearchResultItem[] = [];

    // Extract search results from DuckDuckGo HTML
    const resultBlocks = html.split('<div class="result results_links');

    for (let i = 1; i < resultBlocks.length && results.length < 10; i++) {
      const block = resultBlocks[i];

      // Extract title and URL
      const linkMatch = block.match(/<a class="result__snippet[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

      const titleMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

      let rawUrl = titleMatch ? titleMatch[1] : (linkMatch ? linkMatch[1] : '');
      // Handle duckduckgo redirect wrapper: //duckduckgo.com/l/?uddg=...
      if (rawUrl.includes('uddg=')) {
        try {
          const matchUddg = rawUrl.match(/uddg=([^&]+)/);
          if (matchUddg) rawUrl = decodeURIComponent(matchUddg[1]);
        } catch (_) {}
      }

      const rawTitle = titleMatch ? titleMatch[2].replace(/<[^>]+>/g, '').trim() : '';

      const snippetMatch = block.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/i);
      const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      if (rawUrl && rawTitle) {
        results.push({
          title: rawTitle,
          url: canonicalizeUrl(rawUrl),
          description: rawSnippet,
          displayLink: new URL(rawUrl).hostname.replace(/^www\./, ''),
        });
      }
    }

    return results;
  } catch (err: any) {
    logger.warn('DuckDuckGo fallback search failed:', { error: err.message });
    return [];
  }
}

// ── Orchestrated Multi-Search Execution ──────────────────────────────────────
export async function executeMultiSearch(params: {
  searchInput: string;
  isDeepResearch?: boolean;
}): Promise<DeepSearchExecutionResult> {
  const { searchInput, isDeepResearch = false } = params;
  const complexityScore = computeComplexityScore(searchInput);
  const isComplex = complexityScore >= 40;

  // 1. Check Appwrite 6-hour cache
  const cachedSources = await getCachedSearchResult(searchInput);
  if (cachedSources && cachedSources.length > 0) {
    await logSearchUsage(searchInput, 'cache', 0, complexityScore, null);
    return {
      success: true,
      sources: cachedSources,
      sourceUsed: 'cache',
      isComplex,
      creditsConsumed: 0,
    };
  }

  // 2. Check if reasoning-only puzzle that doesn't need web search
  if (!needsSearch(searchInput)) {
    return {
      success: true,
      sources: [],
      sourceUsed: 'bypassed',
      isComplex,
      useDirectModel: true,
      creditsConsumed: 0,
    };
  }

  let results: SearchResultItem[] = [];
  let sourceUsed: 'tavily' | 'duckduckgo' | 'none' = 'duckduckgo';
  let fallbackReason: string | null = null;
  let creditsConsumed = 0;

  // 3. Simple query: try DuckDuckGo first
  if (!isComplex && !isDeepResearch) {
    try {
      results = await executeDuckDuckGoSearch(searchInput);
      if (results.length < 2) {
        fallbackReason = 'INSUFFICIENT_DDG_RESULTS';
      }
    } catch (err: any) {
      fallbackReason = err.message;
    }
  }

  // 4. Complex or Deep Research or DDG fallback: use Tavily rotation
  if ((isDeepResearch || isComplex || fallbackReason) && TAVILY_KEYS.length > 0) {
    sourceUsed = 'tavily';
    try {
      const depth = isComplex || isDeepResearch ? 'advanced' : 'basic';
      creditsConsumed += isComplex ? 2 : 1;
      results = await executeTavilySearch(searchInput, { searchDepth: depth });
    } catch (err: any) {
      logger.warn('Tavily search failed across all keys:', { error: err.message });
      if (results.length === 0) {
        // Fall back to DuckDuckGo if Tavily failed
        sourceUsed = 'duckduckgo';
        results = await executeDuckDuckGoSearch(searchInput);
      }
    }
  }

  // 5. If everything returned empty, direct AI fallback
  if (results.length === 0) {
    return {
      success: true,
      sources: [],
      sourceUsed: 'none',
      isComplex,
      useDirectModel: true,
      creditsConsumed,
    };
  }

  // Deduplicate and format sources
  const seen = new Set<string>();
  const formatted: SearchResultItem[] = [];

  for (const r of results) {
    const cleanUrl = canonicalizeUrl(r.url);
    if (!cleanUrl || seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    const quality: SourceQualityResult = calculateSourceQualityScore(r, searchInput);
    formatted.push({
      id: formatted.length + 1,
      title: r.title || 'Untitled Source',
      url: cleanUrl,
      description: r.description || '',
      content: r.content,
      displayLink: r.displayLink || (cleanUrl ? new URL(cleanUrl).hostname.replace(/^www\./, '') : ''),
      qualityScore: quality.score,
      qualityBand: quality.band,
      sourceHost: quality.domain,
      deepResearch: true,
    });
  }

  // Save to Appwrite cache and log usage asynchronously
  setCachedSearchResult(searchInput, formatted).catch(() => {});
  logSearchUsage(searchInput, sourceUsed, creditsConsumed, complexityScore, fallbackReason).catch(() => {});

  return {
    success: true,
    sources: formatted,
    sourceUsed,
    isComplex,
    creditsConsumed,
  };
}
