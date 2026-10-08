/**
 * src/services/intelligence/failureMemory.ts
 *
 * Failure Memory & Continuous Learning System.
 * Records recurrent failure patterns and generates preventative guidelines
 * to protect future prompt generations from known pitfalls.
 */

export interface FailurePattern {
  id: string;
  category: 'excessive_verbosity' | 'lazy_code' | 'hallucination' | 'format_violation' | 'repetitive_output';
  occurrenceCount: number;
  lastObserved: number;
  remedyDirective: string;
}

export class FailureMemory {
  private static patterns = new Map<string, FailurePattern>();

  /**
   * Record an observed failure pattern.
   */
  public static record(
    category: FailurePattern['category'],
    remedy: string
  ): void {
    const existing = this.patterns.get(category);
    if (existing) {
      existing.occurrenceCount++;
      existing.lastObserved = Date.now();
      existing.remedyDirective = remedy;
    } else {
      this.patterns.set(category, {
        id: `fail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        category,
        occurrenceCount: 1,
        lastObserved: Date.now(),
        remedyDirective: remedy,
      });
    }
  }

  /**
   * Get active preventative directives to inject into PromptCompiler.
   */
  public static getActiveRemedies(): string[] {
    const active: string[] = [];
    for (const pattern of this.patterns.values()) {
      if (pattern.occurrenceCount >= 2) {
        active.push(`PREVENTATIVE RULE: ${pattern.remedyDirective}`);
      }
    }
    return active;
  }
}
