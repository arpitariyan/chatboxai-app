/**
 * src/server/routes/search.ts
 *
 * Dedicated, lightweight Web Search API for Mobile APK:
 * - Uses Tavily 12-key pool with automatic rotation and failover
 * - DuckDuckGo fallback for fast/free searches
 * - 6-hour Appwrite Search Cache
 * - URL canonicalization and quality scoring
 * - Quota-free: does NOT deduct weekly Deep Research quota
 */

import { Router, Request, Response } from 'express';
import { executeMultiSearch, SearchResultItem } from '../services/research/search-service';
import { canonicalizeUrl } from '../services/research/search-utils';
import { logger } from '../lib/logger';

export const searchRouter = Router();

/**
 * POST /api/mobile/search/execute
 * Lightweight search execution for normal chat with Web Search enabled.
 */
searchRouter.post('/search/execute', async (req: Request, res: Response): Promise<void> => {
  const startAt = Date.now();
  try {
    const { searchInput, maxSources = 8 } = req.body || {};

    if (!searchInput || typeof searchInput !== 'string' || !searchInput.trim()) {
      res.status(400).json({
        error: 'Search input is required',
        code: 'MISSING_SEARCH_INPUT',
      });
      return;
    }

    const query = searchInput.trim();
    logger.info('[WebSearch] Executing lightweight search:', { query });

    const searchResult = await executeMultiSearch({
      searchInput: query,
      isDeepResearch: false,
    });

    const sources = (searchResult.sources || []).slice(0, Math.min(Number(maxSources) || 8, 12));

    const durationMs = Date.now() - startAt;

    res.status(200).json({
      success: true,
      sources,
      sourceUsed: searchResult.sourceUsed,
      isComplex: searchResult.isComplex,
      durationMs,
    });
  } catch (error: any) {
    logger.error('[WebSearch] Search execution failed:', { error: error.message });
    res.status(500).json({
      error: 'Web search execution failed',
      code: 'SEARCH_FAILED',
      message: error.message,
    });
  }
});
