/**
 * src/server/routes/research.ts
 *
 * Deep Research API Routes for Mobile Backend:
 * - GET  /api/mobile/research/usage   (weekly quota check)
 * - POST /api/mobile/research/execute (multi-angle search + enrichment + PEARL synthesis)
 * - POST /api/mobile/research/usage/log (explicit usage logging)
 */

import { Router, Request, Response } from 'express';
import { extractBearerToken, verifyToken, requireFirebaseUser } from '../lib/firebase-admin';
import { checkResearchLimit, logResearchUsage, ResearchQuotaStatus } from '../lib/quota-manager';
import { analyzeIntentWithLLM } from '../services/research/intent-planner';
import { executeMultiSearch, SearchResultItem } from '../services/research/search-service';
import { fetchPageContent, heuristicSummary } from '../services/research/page-scraper';
import { synthesizeResearch } from '../services/research/pearl-synthesizer';
import { canonicalizeUrl } from '../services/research/search-utils';
import { logger } from '../lib/logger';

export const researchRouter = Router();

// Informational GET endpoint
researchRouter.get('/research', (_req: Request, res: Response): void => {
  res.status(200).json({
    ok: true,
    service: 'chatboxai-mobile-deep-research',
    status: 'ready',
    version: '1.0.0',
    endpoints: {
      usage: 'GET /api/mobile/research/usage',
      execute: 'POST /api/mobile/research/execute',
      log: 'POST /api/mobile/research/usage/log',
    },
    weeklyLimits: {
      free: 5,
      pro: 15,
      max: 25,
      reset: 'Every Sunday 00:00:00 UTC',
    },
  });
});

/**
 * GET /api/mobile/research/usage
 * Returns the current user's weekly research usage, remaining quota, and reset time.
 * Supports Bearer token in header, or optional user_email query param.
 */
researchRouter.get('/research/usage', async (req: Request, res: Response): Promise<void> => {
  try {
    let email = '';
    let userId: string | undefined = undefined;

    // 1. Try to resolve from Bearer token if provided
    const token = extractBearerToken(req);
    if (token) {
      try {
        const authUser = await verifyToken(token);
        email = authUser.email;
        userId = authUser.uid;
      } catch (authErr: any) {
        logger.warn('Token provided for research usage check was invalid/expired:', {
          error: authErr.message,
        });
      }
    }

    // 2. Fallback to query param if token wasn't provided or was guest
    if (!email && req.query.user_email && typeof req.query.user_email === 'string') {
      email = req.query.user_email.trim().toLowerCase();
    }

    const quota: ResearchQuotaStatus = await checkResearchLimit(email, userId);

    res.status(200).json({
      success: true,
      ...quota,
    });
  } catch (error: any) {
    logger.error('Failed to get research usage:', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve research usage',
      code: 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});

/**
 * POST /api/mobile/research/execute
 * Main Deep Research pipeline:
 * 1. Validates auth & weekly quota
 * 2. Plans 4-6 diverse search angles
 * 3. Dispatches parallel multi-provider searches (Tavily rotation + DDG fallback)
 * 4. Deduplicates and scores sources
 * 5. Scrapes page contents and generates heuristic summaries
 * 6. Synthesizes final report with PEARL reasoning and inline citations
 * 7. Records usage log in Appwrite
 */
researchRouter.post('/research/execute', async (req: Request, res: Response): Promise<void> => {
  const startAt = Date.now();
  try {
    const {
      searchInput,
      selectedModel = 'auto',
      maxSources = 15,
      conversationHistory = [],
      user_email,
    } = req.body || {};

    if (!searchInput || typeof searchInput !== 'string' || !searchInput.trim()) {
      res.status(400).json({
        error: 'Search input is required',
        code: 'MISSING_SEARCH_INPUT',
      });
      return;
    }

    // 1. Resolve user and enforce weekly limits
    let email = '';
    let userId: string | undefined = undefined;

    const token = extractBearerToken(req);
    if (token) {
      try {
        const authUser = await verifyToken(token);
        email = authUser.email;
        userId = authUser.uid;
      } catch (authErr: any) {
        logger.warn('Token verification failed during research execution:', { error: authErr.message });
      }
    }

    if (!email && user_email && typeof user_email === 'string') {
      email = user_email.trim().toLowerCase();
    }

    const quota = await checkResearchLimit(email, userId);
    if (!quota.canResearch) {
      res.status(403).json({
        error: 'RESEARCH_LIMIT_REACHED',
        message: quota.message,
        remaining: quota.remaining,
        weeklyCount: quota.weeklyCount,
        weeklyLimit: quota.weeklyLimit,
        resetsAt: quota.resetsAt,
        plan: quota.plan,
      });
      return;
    }

    logger.info('Starting Deep Research execution:', {
      email: email || 'guest',
      prompt: searchInput.slice(0, 60),
    });

    // 2. Planning Phase
    const planningStart = Date.now();
    const queryPlan = await analyzeIntentWithLLM(searchInput.trim());
    const planningDurationMs = Date.now() - planningStart;

    // 3. Multi-Query Search Retrieval Phase
    const retrievalStart = Date.now();
    const selectedQueries = queryPlan.queries.slice(0, 4);

    const searchPromises = selectedQueries.map(q =>
      executeMultiSearch({ searchInput: q, isDeepResearch: true }).catch(() => null)
    );
    const searchResults = await Promise.all(searchPromises);

    // Flatten and deduplicate sources
    const allSources: SearchResultItem[] = [];
    const seenUrls = new Set<string>();

    for (const res of searchResults) {
      if (res && res.sources) {
        for (const s of res.sources) {
          const cleanUrl = canonicalizeUrl(s.url);
          if (cleanUrl && !seenUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            allSources.push({
              ...s,
              url: cleanUrl,
              id: allSources.length + 1,
            });
          }
        }
      }
    }

    // Sort by quality score and limit
    allSources.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    const finalSources = allSources.slice(0, Math.min(Number(maxSources) || 15, 20));
    const retrievalDurationMs = Date.now() - retrievalStart;

    // 4. Page Scraping & Content Enrichment Phase (Top 6 sources)
    const enrichmentStart = Date.now();
    const enrichmentTargets = finalSources.slice(0, 6);
    await Promise.allSettled(
      enrichmentTargets.map(async src => {
        const text = await fetchPageContent(src.url, 6000);
        if (text) {
          const { summary, keyPoints } = heuristicSummary(text);
          src.content = text.slice(0, 500);
          if (summary) src.description = summary;
          if (keyPoints.length > 0) (src as any).keyPoints = keyPoints;
        }
      })
    );
    const enrichmentDurationMs = Date.now() - enrichmentStart;

    // 5. PEARL Synthesis Phase
    const synthesisStart = Date.now();
    const synthesis = await synthesizeResearch({
      searchInput: searchInput.trim(),
      sources: finalSources,
      selectedModel,
      conversationHistory,
    });
    const synthesisDurationMs = Date.now() - synthesisStart;

    // 6. Log usage asynchronously
    if (email) {
      logResearchUsage(email, userId).catch(err => {
        logger.warn('Asynchronous research usage log failed:', { error: err.message });
      });
    }

    const totalDurationMs = Date.now() - startAt;

    res.status(200).json({
      success: true,
      aiResponse: synthesis.aiResponse,
      thinkingContent: synthesis.thinkingContent,
      confidence: synthesis.confidence,
      sources: finalSources,
      searchResult: finalSources,
      metadata: {
        queriesExecuted: selectedQueries,
        totalSourcesFound: allSources.length,
        uniqueSources: finalSources.length,
        enrichedSources: enrichmentTargets.length,
        durationsMs: {
          planning: planningDurationMs,
          retrieval: retrievalDurationMs,
          enrichment: enrichmentDurationMs,
          synthesis: synthesisDurationMs,
          total: totalDurationMs,
        },
      },
    });
  } catch (error: any) {
    logger.error('Deep Research execution failed:', { error: error.message });
    res.status(500).json({
      error: 'Deep Research execution failed',
      code: 'RESEARCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * POST /api/mobile/research/usage/log
 * Authenticated endpoint to record a research execution in Appwrite.
 */
researchRouter.post(
  '/research/usage/log',
  requireFirebaseUser,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      await logResearchUsage(user.email, user.uid);
      res.status(200).json({
        success: true,
        message: 'Research usage logged successfully',
      });
    } catch (error: any) {
      logger.error('Failed to record research usage log:', { error: error.message });
      res.status(500).json({
        error: 'Failed to record usage log',
        code: 'LOG_ERROR',
      });
    }
  }
);
