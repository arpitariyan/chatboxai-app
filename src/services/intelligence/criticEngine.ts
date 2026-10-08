/**
 * src/services/intelligence/criticEngine.ts
 *
 * Response Critic & Evaluation Engine.
 * Evaluates candidate responses against multidimensional criteria:
 * correctness, relevance, completeness, instruction following, clarity, safety.
 * Returns structured metrics and targeted refinement directives.
 */

import {
  IntentClassification,
  ComplexityEstimate,
  AnswerContract,
  CriticScore,
} from './types';
import { getQualityThreshold } from './qualityThresholds';
import { DeterministicVerificationResult } from './types';
import { GroundingAuditResult } from './hallucinationFirewall';

export class ResponseCritic {
  /**
   * Evaluates response quality and determines whether refinement is required.
   */
  public static evaluate(
    query: string,
    response: string,
    intent: IntentClassification,
    complexity: ComplexityEstimate,
    contract: AnswerContract,
    verification: DeterministicVerificationResult,
    grounding: GroundingAuditResult
  ): CriticScore {
    const defects: string[] = [];
    const lowerResponse = response.toLowerCase();
    const wordCount = response.trim().split(/\s+/).length;

    // 1. Instruction Following (0.0 - 1.0)
    let instructionScore = 0.95;

    // Check brevity contract
    if (contract.tone === 'concise' && wordCount > 120) {
      defects.push('Violated concise contract: response is too verbose.');
      instructionScore -= 0.25;
    }

    // Check code-only contract
    if (contract.format === 'code_only' && !response.trim().startsWith('```')) {
      defects.push('Violated code_only contract: included non-code conversational text.');
      instructionScore -= 0.35;
    }

    // Check table contract
    if (contract.format === 'table' && !response.includes('|---')) {
      defects.push('Violated table contract: failed to format output as Markdown table.');
      instructionScore -= 0.30;
    }

    // 2. Completeness (0.0 - 1.0)
    let completenessScore = 0.90;
    if (wordCount < 10 && intent.primaryIntent !== 'general_chat') {
      defects.push('Response is too brief/incomplete for the requested query.');
      completenessScore -= 0.40;
    }

    // Check coding completeness: detect lazy placeholders
    if (
      intent.primaryIntent === 'coding' &&
      (/\/\/\s*\.\.\.\s*rest of code/i.test(response) || /\/\/\s*add logic here/i.test(response))
    ) {
      defects.push('Lazy placeholder detected in code snippet ("// rest of code"). Complete implementation required.');
      completenessScore -= 0.30;
    }

    // 3. Correctness & Deterministic Validity (0.0 - 1.0)
    let correctnessScore = 0.95;
    if (!verification.isValid) {
      for (const issue of verification.issues) {
        if (issue.severity === 'critical') {
          defects.push(`Critical verification defect: ${issue.message}`);
          correctnessScore -= 0.40;
        } else {
          correctnessScore -= 0.10;
        }
      }
    }

    // 4. Grounding & Hallucination Risk (0.0 - 1.0)
    let safetyScore = 0.98;
    if (grounding.hallucinationRisk === 'HIGH') {
      defects.push('High hallucination risk: ungrounded assertions or invalid citations.');
      correctnessScore -= 0.25;
    }

    // 5. Clarity (0.0 - 1.0)
    let clarityScore = 0.92;
    // Check for repetitive loops (repeated 15+ char substrings)
    const sentences = response.split(/[.!?]\s+/);
    const seenSentences = new Set<string>();
    let duplicateCount = 0;
    for (const s of sentences) {
      const clean = s.trim().toLowerCase();
      if (clean.length > 25) {
        if (seenSentences.has(clean)) {
          duplicateCount++;
        }
        seenSentences.add(clean);
      }
    }
    if (duplicateCount > 1) {
      defects.push('Detected repetitive sentences in output.');
      clarityScore -= 0.25;
    }

    // 6. Overall Score Computation
    const correctness = Math.max(0.1, Math.min(1.0, correctnessScore));
    const relevance = 0.95;
    const completeness = Math.max(0.1, Math.min(1.0, completenessScore));
    const instructionFollowing = Math.max(0.1, Math.min(1.0, instructionScore));
    const clarity = Math.max(0.1, Math.min(1.0, clarityScore));
    const safety = Math.max(0.1, Math.min(1.0, safetyScore));

    const overallScore = parseFloat(
      (
        correctness * 0.35 +
        instructionFollowing * 0.25 +
        completeness * 0.20 +
        clarity * 0.10 +
        safety * 0.10
      ).toFixed(2)
    );

    const threshold = getQualityThreshold(
      intent.primaryIntent,
      complexity.level === 'HIGH' || complexity.level === 'CRITICAL'
    );

    const passedThreshold = overallScore >= threshold && defects.length === 0;

    let suggestedRefinementDirective: string | undefined;
    if (defects.length > 0) {
      suggestedRefinementDirective = `Fix the following defects strictly:\n${defects
        .map((d, i) => `${i + 1}. ${d}`)
        .join('\n')}`;
    }

    return {
      correctness,
      relevance,
      completeness,
      instructionFollowing,
      clarity,
      safety,
      overallScore,
      passedThreshold,
      defectsIdentified: defects,
      suggestedRefinementDirective,
    };
  }
}
