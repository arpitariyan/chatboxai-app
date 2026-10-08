/**
 * src/services/intelligence/confidenceEngine.ts
 *
 * Multi-factor Confidence Estimation Engine.
 * Evaluates evidence grounding, verification status, critic agreement, and ambiguity
 * to assign an objective HIGH, MEDIUM, or LOW confidence level.
 */

import { ConfidenceAssessment, ConfidenceLevel, CriticScore, DeterministicVerificationResult } from './types';
import { GroundingAuditResult } from './hallucinationFirewall';

export class ConfidenceEngine {
  /**
   * Assesses overall confidence of response.
   */
  public static assess(
    query: string,
    critic: CriticScore,
    verification: DeterministicVerificationResult,
    grounding: GroundingAuditResult
  ): ConfidenceAssessment {
    // 1. Source Grounding Factor (0 - 100)
    const sourceGroundingScore = Math.round(grounding.groundedRatio * 100);

    // 2. Verification Factor (0 - 100)
    let verificationScore = 95;
    if (!verification.isValid) {
      verificationScore = 40;
    } else if (verification.issues.length > 0) {
      verificationScore = 75;
    }

    // 3. Critic Agreement Factor (0 - 100)
    const criticAgreementScore = Math.round(critic.overallScore * 100);

    // 4. Query Ambiguity Penalty (0 - 20)
    let queryAmbiguityPenalty = 0;
    const wordCount = query.trim().split(/\s+/).length;
    if (wordCount < 4 && !query.includes('?')) {
      queryAmbiguityPenalty = 15;
    }

    // Weighted Combined Score
    const rawScore =
      sourceGroundingScore * 0.35 +
      verificationScore * 0.35 +
      criticAgreementScore * 0.30 -
      queryAmbiguityPenalty;

    const finalScore = Math.max(10, Math.min(100, Math.round(rawScore)));

    let level: ConfidenceLevel = 'MEDIUM';
    let explanation = '';

    if (finalScore >= 82) {
      level = 'HIGH';
      explanation = 'High confidence: robust factual grounding, valid deterministic checks, and strong critic evaluation.';
    } else if (finalScore >= 60) {
      level = 'MEDIUM';
      explanation = 'Medium confidence: answer is coherent and mostly grounded, with minor ambiguity or non-critical warnings.';
    } else {
      level = 'LOW';
      explanation = 'Low confidence: possible factual uncertainty, verification defect, or high query ambiguity.';
    }

    return {
      level,
      score: finalScore,
      factors: {
        sourceGroundingScore,
        verificationScore,
        criticAgreementScore,
        queryAmbiguityPenalty,
      },
      explanation,
    };
  }
}
