/**
 * src/services/intelligence/complexityEngine.ts
 *
 * Adaptive Compute & Complexity Estimation Engine.
 * Dynamically assigns compute budget, token limits, and verification requirements.
 * Ensures mobile responsiveness and avoids wasting battery/tokens on trivial inputs.
 */

import { IntentClassification, ComplexityLevel, ComplexityEstimate } from './types';

export class ComplexityEngine {
  /**
   * Estimate complexity and define the execution budget.
   */
  public static estimate(
    query: string,
    intent: IntentClassification,
    conversationHistoryLength: number = 0
  ): ComplexityEstimate {
    const trimmed = query.trim();
    const wordCount = trimmed.split(/\s+/).length;
    let score = 20; // baseline

    // 1. Length Factor
    if (wordCount > 60) score += 25;
    else if (wordCount > 25) score += 15;
    else if (wordCount < 6) score -= 10;

    // 2. Intent Factor
    switch (intent.primaryIntent) {
      case 'general_chat':
        score -= 15;
        break;
      case 'translation':
      case 'summarization':
        score += 10;
        break;
      case 'coding':
      case 'debugging':
        score += 25;
        break;
      case 'comparison':
      case 'planning':
      case 'research':
        score += 30;
        break;
      case 'multimodal':
      case 'file_analysis':
        score += 35;
        break;
      default:
        break;
    }

    // 3. Technical & Logical Markers
    if (intent.hasCodeSnippet) score += 20;
    if (trimmed.includes('{') && trimmed.includes('}')) score += 10;
    if (/\b(step by step|detailed|comprehensive|in-depth|trade-offs|architecture)\b/i.test(trimmed)) {
      score += 15;
    }
    if (/\b(unit tests?|error handling|backoff|concurrency|retry|mutex|transaction|security)\b/i.test(trimmed)) {
      score += 15;
    }

    // 4. Conversation Depth Factor
    if (conversationHistoryLength > 8) {
      score += 10;
    }

    // Clamp score to 0 - 100
    const clampedScore = Math.max(5, Math.min(100, score));

    // Map to ComplexityLevel
    let level: ComplexityLevel;
    let maxInputTokens = 2048;
    let maxOutputTokens = 1024;
    let allowRefinement = false;
    let maxRefinementPasses = 0;
    let requireCriticEvaluation = false;
    let requireDeterministicVerification = true;
    let rationale = '';

    if (clampedScore < 30) {
      level = 'LOW';
      maxInputTokens = 1024;
      maxOutputTokens = 512;
      allowRefinement = false;
      maxRefinementPasses = 0;
      requireCriticEvaluation = false;
      requireDeterministicVerification = true;
      rationale = 'Low complexity query. Fast single-pass generation with deterministic sanity checks.';
    } else if (clampedScore < 60) {
      level = 'MEDIUM';
      maxInputTokens = 3072;
      maxOutputTokens = 1536;
      allowRefinement = false;
      maxRefinementPasses = 0;
      requireCriticEvaluation = true;
      requireDeterministicVerification = true;
      rationale = 'Moderate complexity. Standard generation with lightweight quality scoring.';
    } else if (clampedScore < 85) {
      level = 'HIGH';
      maxInputTokens = 6144;
      maxOutputTokens = 2500;
      allowRefinement = true;
      maxRefinementPasses = 1;
      requireCriticEvaluation = true;
      requireDeterministicVerification = true;
      rationale = 'High complexity. Generation with deterministic verification, critic gate, and up to 1 refinement pass.';
    } else {
      level = 'CRITICAL';
      maxInputTokens = 8192;
      maxOutputTokens = 4096;
      allowRefinement = true;
      maxRefinementPasses = 2;
      requireCriticEvaluation = true;
      requireDeterministicVerification = true;
      rationale = 'Critical complexity. Full multi-stage pipeline with strict verification and up to 2 targeted refinement passes.';
    }

    return {
      level,
      score: clampedScore,
      tokenBudget: {
        maxInputTokens,
        maxOutputTokens,
      },
      computeBudget: {
        allowRefinement,
        maxRefinementPasses,
        requireCriticEvaluation,
        requireDeterministicVerification,
      },
      rationale,
    };
  }
}
