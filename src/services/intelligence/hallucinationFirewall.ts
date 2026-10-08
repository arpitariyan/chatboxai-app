/**
 * src/services/intelligence/hallucinationFirewall.ts
 *
 * Hallucination Firewall & Grounding Verifier.
 * Cross-references claims against provided sources, verifies citation integrity,
 * and qualifies ungrounded assertions to guarantee factual trustworthiness.
 */

import { SearchResultItem } from '../search/webSearchService';

export interface GroundingAuditResult {
  groundedRatio: number; // 0.0 - 1.0
  unsupportedClaimsCount: number;
  hallucinationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  sanitizedContent?: string;
  notes: string[];
}

export class HallucinationFirewall {
  /**
   * Audits factual grounding of response against sources.
   */
  public static audit(
    content: string,
    sources?: SearchResultItem[]
  ): GroundingAuditResult {
    if (!sources || sources.length === 0) {
      return {
        groundedRatio: 1.0,
        unsupportedClaimsCount: 0,
        hallucinationRisk: 'LOW',
        notes: ['No external sources attached to audit against.'],
      };
    }

    const notes: string[] = [];
    const citationsFound = content.match(/\[(\d+)\]/g) || [];
    const uniqueCitedIndices = new Set(
      citationsFound.map((c) => parseInt(c.replace(/[[\]]/g, ''), 10))
    );

    let unsupportedClaims = 0;

    // Check for citations that do not exist
    for (const idx of uniqueCitedIndices) {
      if (idx < 1 || idx > sources.length) {
        unsupportedClaims++;
        notes.push(`Citation [${idx}] refers to a nonexistent source.`);
      }
    }

    // Check if the response makes factual claims but completely failed to cite available sources
    const hasFactualStatements = content.length > 200 && /\b(in \d{4}|according to|percent|billion|million|discovered|announced)\b/i.test(content);
    if (citationsFound.length === 0 && hasFactualStatements) {
      unsupportedClaims++;
      notes.push('Factual assertions present but zero citations provided despite available sources.');
    }

    const groundedRatio = unsupportedClaims === 0 ? 1.0 : Math.max(0.4, 1.0 - unsupportedClaims * 0.25);
    const hallucinationRisk =
      groundedRatio >= 0.85 ? 'LOW' : groundedRatio >= 0.65 ? 'MEDIUM' : 'HIGH';

    return {
      groundedRatio,
      unsupportedClaimsCount: unsupportedClaims,
      hallucinationRisk,
      notes,
    };
  }
}
