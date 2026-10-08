/**
 * src/services/intelligence/contradictionDetector.ts
 *
 * Contradiction & Recency Priority Engine.
 * Detects conflicts between current user request and older conversation memory,
 * ensuring newest instructions strictly override stale assumptions.
 */

export interface ContradictionCheckResult {
  hasContradiction: boolean;
  overriddenInstructions: string[];
  guidanceNote?: string;
}

export class ContradictionDetector {
  /**
   * Compares current prompt against prior turns to detect explicit overrides.
   */
  public static detect(
    currentQuery: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): ContradictionCheckResult {
    if (history.length === 0) {
      return { hasContradiction: false, overriddenInstructions: [] };
    }

    const lowerCurrent = currentQuery.toLowerCase();
    const overridden: string[] = [];

    // Negative override markers: "instead", "no, change to", "actually", "forget that", "scratch that"
    const isOverride =
      /\b(instead|actually|scratch that|forget that|no wait|change to|rather than|switch to|don't do)\b/i.test(
        lowerCurrent
      );

    if (isOverride) {
      overridden.push('User explicitly requested an override or change of direction from previous turns.');
    }

    // Language switch detection
    const wantsHindi = /\b(in hindi|hindi me|hindi mein)\b/i.test(lowerCurrent);
    const wantsEnglish = /\b(in english)\b/i.test(lowerCurrent);
    if (wantsHindi || wantsEnglish) {
      overridden.push(`Language preference override detected (${wantsHindi ? 'Hindi' : 'English'}).`);
    }

    // Format switch detection
    if (/\b(now in table|make it a table|in bullets instead)\b/i.test(lowerCurrent)) {
      overridden.push('Format style switch detected.');
    }

    return {
      hasContradiction: overridden.length > 0,
      overriddenInstructions: overridden,
      guidanceNote:
        overridden.length > 0
          ? 'PRIORITY DIRECTIVE: The user has updated their requirements in the latest message. ' +
            'Prioritize their newest instruction completely over older messages.'
          : undefined,
    };
  }
}
