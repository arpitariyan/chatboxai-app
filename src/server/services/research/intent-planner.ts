/**
 * src/server/services/research/intent-planner.ts
 *
 * Multi-Angle Query Planner for Deep Research.
 * Decomposes complex user queries into 4-6 specialized sub-search queries
 * covering core facts, latest updates, data/benchmarks, implementation, and counter-perspectives.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../lib/logger';
import { keywordOverlapScore } from './search-utils';

export interface PlannedQueryItem {
  query: string;
  angle: string;
  priority: number;
  index: number;
}

export interface IntentAnalysisResult {
  intent: 'inform' | 'compare' | 'build' | 'decision';
  depth: 'deep' | 'standard' | 'quick';
  domain: string;
  intentAnalysis?: string;
}

export interface QueryPlanResult {
  queryAnalysis: IntentAnalysisResult;
  rankedPlan: PlannedQueryItem[];
  queries: string[];
}

const DOMAIN_HINTS: Record<string, string[]> = {
  engineering: ['api', 'code', 'software', 'architecture', 'debug', 'performance', 'javascript', 'python', 'react', 'node'],
  business: ['pricing', 'market', 'revenue', 'startup', 'roi', 'strategy', 'customer', 'sales'],
  health: ['health', 'medical', 'clinical', 'treatment', 'disease', 'patient'],
  legal: ['law', 'legal', 'regulation', 'compliance', 'policy', 'contract'],
  finance: ['finance', 'investment', 'stock', 'valuation', 'budget', 'cost', 'crypto'],
};

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
  if (words.length >= 12 || /(deep|comprehensive|detailed|expert|benchmark)/i.test(normalized)) {
    depth = 'deep';
  } else if (words.length <= 5) {
    depth = 'quick';
  }

  let domain = 'general';
  for (const [candidate, keywords] of Object.entries(DOMAIN_HINTS)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      domain = candidate;
      break;
    }
  }

  return { intent, depth, domain };
}

export function buildHeuristicResearchPlan(mainPrompt: string, queryAnalysis: IntentAnalysisResult): PlannedQueryItem[] {
  const basePlans = [
    { angle: 'core', query: mainPrompt, basePriority: 1.0 },
    { angle: 'overview', query: `comprehensive overview of ${mainPrompt}`, basePriority: 0.92 },
    { angle: 'latest', query: `latest developments updates on ${mainPrompt}`, basePriority: 0.88 },
    { angle: 'expert', query: `expert analysis of ${mainPrompt}`, basePriority: 0.86 },
    { angle: 'data', query: `statistics data benchmarks for ${mainPrompt}`, basePriority: 0.9 },
    { angle: 'examples', query: `case studies real world examples of ${mainPrompt}`, basePriority: 0.82 },
    { angle: 'implementation', query: `best practices implementation patterns for ${mainPrompt}`, basePriority: 0.84 },
    { angle: 'risks', query: `challenges risks tradeoffs for ${mainPrompt}`, basePriority: 0.83 },
  ];

  return basePlans
    .map((plan, idx) => {
      const overlap = keywordOverlapScore(mainPrompt, plan.query);
      const priority = Number((plan.basePriority + overlap * 0.15).toFixed(3));
      return {
        ...plan,
        priority,
        index: idx + 1,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

export async function analyzeIntentWithLLM(mainPrompt: string): Promise<QueryPlanResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    const analysis = detectQueryIntent(mainPrompt);
    const plan = buildHeuristicResearchPlan(mainPrompt, analysis);
    return {
      queryAnalysis: analysis,
      rankedPlan: plan,
      queries: plan.map(p => p.query),
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a staff research director. Analyze the user query and generate 4 to 6 diverse search queries across technical, market, recent updates, and tradeoff perspectives.
User Query: "${mainPrompt}"

Respond ONLY with valid JSON:
{
  "intentAnalysis": "Detailed brief of what the user needs and optimal analytical angles.",
  "queries": [
    "sub query 1",
    "sub query 2",
    "sub query 3",
    "sub query 4"
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
      intent: 'inform',
      depth: 'deep',
      domain: 'general',
      intentAnalysis: parsed.intentAnalysis || 'Deep multi-angle research plan',
    };

    const rankedPlan: PlannedQueryItem[] = queries.map((q, idx) => ({
      query: q,
      angle: `angle_${idx + 1}`,
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
    const analysis = detectQueryIntent(mainPrompt);
    const plan = buildHeuristicResearchPlan(mainPrompt, analysis);
    return {
      queryAnalysis: analysis,
      rankedPlan: plan,
      queries: plan.map(p => p.query),
    };
  }
}
