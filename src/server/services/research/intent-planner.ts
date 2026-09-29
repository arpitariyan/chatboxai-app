/**
 * src/server/services/research/intent-planner.ts
 *
 * Upgraded Multi-Stage Intent & Research Strategy Engine:
 * - Stage 1: Query Intent Analysis & Entity/Temporal Extraction
 * - Stage 2: Orthogonal Research Strategy Planning (Core, Empirical, Implementation, Tradeoffs)
 * - Stage 3: Targeted Search Query Formulation (4-6 non-overlapping queries)
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../lib/logger';
import { keywordOverlapScore } from './search-utils';

export interface PlannedQueryItem {
  query: string;
  angle: 'core' | 'empirical' | 'implementation' | 'tradeoffs' | 'recent';
  priority: number;
  index: number;
}

export interface IntentAnalysisResult {
  intent: 'inform' | 'compare' | 'build' | 'decision';
  depth: 'deep' | 'standard' | 'quick';
  domain: string;
  temporalConstraint?: string;
  keyEntities: string[];
  intentAnalysis?: string;
}

export interface QueryPlanResult {
  queryAnalysis: IntentAnalysisResult;
  rankedPlan: PlannedQueryItem[];
  queries: string[];
}

const DOMAIN_HINTS: Record<string, string[]> = {
  engineering: ['api', 'code', 'software', 'architecture', 'debug', 'performance', 'javascript', 'python', 'react', 'node', 'expo', 'database'],
  business: ['pricing', 'market', 'revenue', 'startup', 'roi', 'strategy', 'customer', 'sales', 'growth'],
  health: ['health', 'medical', 'clinical', 'treatment', 'disease', 'patient', 'therapy'],
  legal: ['law', 'legal', 'regulation', 'compliance', 'policy', 'contract', 'terms'],
  finance: ['finance', 'investment', 'stock', 'valuation', 'budget', 'cost', 'crypto', 'interest', 'inflation'],
  science: ['quantum', 'physics', 'biology', 'chemistry', 'astronomy', 'materials', 'energy'],
};

/**
 * Stage 1: Heuristic Query Intent Analysis
 */
export function detectQueryIntent(mainPrompt: string): IntentAnalysisResult {
  const normalized = String(mainPrompt || '').toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);

  const isComparison = /(compare|vs\.?|difference|better|best)/i.test(normalized);
  const isHowTo = /(how to|build|implement|setup|step by step)/i.test(normalized);
  const isDecision = /(choose|recommend|should i|which one)/i.test(normalized);

  let intent: 'inform' | 'compare' | 'build' | 'decision' = 'inform';
  if (isComparison) intent = 'compare';
  else if (isHowTo) intent = 'build';
  else if (isDecision) intent = 'decision';

  let depth: 'deep' | 'standard' | 'quick' = 'standard';
  if (words.length >= 10 || /(deep|comprehensive|detailed|expert|benchmark|tradeoffs)/i.test(normalized)) {
    depth = 'deep';
  } else if (words.length <= 4) {
    depth = 'quick';
  }

  let domain = 'general';
  for (const [candidate, keywords] of Object.entries(DOMAIN_HINTS)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      domain = candidate;
      break;
    }
  }

  // Detect temporal markers (e.g. 2024, 2025, 2026, latest, recent)
  let temporalConstraint: string | undefined = undefined;
  const yearMatch = normalized.match(/\b(202[4-7])\b/);
  if (yearMatch) {
    temporalConstraint = yearMatch[1];
  } else if (/(latest|recent|current|today|newest)/i.test(normalized)) {
    temporalConstraint = 'current';
  }

  // Extract candidate entities
  const keyEntities = words.filter(w => w.length > 3 && !/^(what|when|where|which|about|there|their|should|would|could)$/i.test(w)).slice(0, 4);

  return { intent, depth, domain, temporalConstraint, keyEntities };
}

/**
 * Stage 2 & 3: Heuristic Multi-Angle Query Formulation Fallback
 */
export function buildHeuristicResearchPlan(mainPrompt: string, queryAnalysis: IntentAnalysisResult): PlannedQueryItem[] {
  const year = queryAnalysis.temporalConstraint || '2026';
  const basePlans: Array<{ angle: PlannedQueryItem['angle']; query: string; basePriority: number }> = [
    { angle: 'core', query: mainPrompt, basePriority: 1.0 },
    { angle: 'empirical', query: `${mainPrompt} benchmarks statistics data`, basePriority: 0.92 },
    { angle: 'recent', query: `${mainPrompt} latest developments ${year}`, basePriority: 0.88 },
    { angle: 'implementation', query: `${mainPrompt} architectural patterns real world examples`, basePriority: 0.86 },
    { angle: 'tradeoffs', query: `${mainPrompt} limitations challenges drawbacks risks`, basePriority: 0.85 },
  ];

  return basePlans
    .map((plan, idx) => {
      const overlap = keywordOverlapScore(mainPrompt, plan.query);
      const priority = Number((plan.basePriority + overlap * 0.1).toFixed(3));
      return {
        ...plan,
        priority,
        index: idx + 1,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Orchestrates Stages 1, 2, and 3: Intent Analysis + Research Strategy + Targeted Queries
 */
export async function analyzeIntentWithLLM(mainPrompt: string): Promise<QueryPlanResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    '';

  const heuristicAnalysis = detectQueryIntent(mainPrompt);

  if (!apiKey) {
    const plan = buildHeuristicResearchPlan(mainPrompt, heuristicAnalysis);
    return {
      queryAnalysis: heuristicAnalysis,
      rankedPlan: plan,
      queries: plan.map(p => p.query),
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a Principal Research Architect. Conduct a deep intent analysis and formulate an orthogonal research strategy for this user query.
User Query: "${mainPrompt}"

Generate 4 to 6 focused, non-overlapping search queries covering:
1. Core technical definition / baseline facts
2. Empirical benchmarks, quantitative data, or official documentation
3. Real-world case studies or implementation patterns
4. Tradeoffs, limitations, and counter-perspectives
5. Latest current updates (2025/2026)

Respond ONLY with valid JSON:
{
  "intentAnalysis": "1-2 sentence analytical brief of user intent and research goal.",
  "keyEntities": ["entity1", "entity2"],
  "queries": [
    "search query 1 (baseline)",
    "search query 2 (empirical benchmarks)",
    "search query 3 (implementation)",
    "search query 4 (tradeoffs & risks)"
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    const queries: string[] = Array.isArray(parsed.queries) ? parsed.queries.slice(0, 6) : [];

    if (queries.length < 2) {
      throw new Error('LLM generated fewer than 2 search queries');
    }

    const queryAnalysis: IntentAnalysisResult = {
      intent: heuristicAnalysis.intent,
      depth: 'deep',
      domain: heuristicAnalysis.domain,
      temporalConstraint: heuristicAnalysis.temporalConstraint,
      keyEntities: Array.isArray(parsed.keyEntities) ? parsed.keyEntities : heuristicAnalysis.keyEntities,
      intentAnalysis: parsed.intentAnalysis || 'Deep multi-angle research plan',
    };

    const angles: Array<PlannedQueryItem['angle']> = ['core', 'empirical', 'implementation', 'tradeoffs', 'recent'];
    const rankedPlan: PlannedQueryItem[] = queries.map((q, idx) => ({
      query: q,
      angle: angles[idx % angles.length],
      priority: Number((1.0 - idx * 0.05).toFixed(2)),
      index: idx + 1,
    }));

    return {
      queryAnalysis,
      rankedPlan,
      queries,
    };
  } catch (err: any) {
    logger.warn('LLM Intent planning failed, falling back to heuristics:', { error: err.message });
    const plan = buildHeuristicResearchPlan(mainPrompt, heuristicAnalysis);
    return {
      queryAnalysis: heuristicAnalysis,
      rankedPlan: plan,
      queries: plan.map(p => p.query),
    };
  }
}
