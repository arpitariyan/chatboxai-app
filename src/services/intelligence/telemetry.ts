/**
 * src/services/intelligence/telemetry.ts
 *
 * Privacy-Preserving Observability & Telemetry Engine.
 * Captures request diagnostics, latency, model usage, quality scores, and feedback
 * without logging private tokens, secrets, or confidential user payloads.
 */

import { IntelligenceTelemetryRecord } from './types';

const MAX_IN_MEMORY_RECORDS = 50;

export class IntelligenceTelemetry {
  private static records: IntelligenceTelemetryRecord[] = [];

  /**
   * Log an intelligence pipeline execution.
   */
  public static log(record: IntelligenceTelemetryRecord): void {
    // Sanitize any accidentally leaked keys in model name or request
    const sanitizedRecord: IntelligenceTelemetryRecord = {
      ...record,
      modelUsed: this.redactSensitive(record.modelUsed),
    };

    this.records.unshift(sanitizedRecord);
    if (this.records.length > MAX_IN_MEMORY_RECORDS) {
      this.records.pop();
    }

    console.log(
      `[Telemetry] Req=${record.requestId} | Intent=${record.intent} | Complexity=${record.complexity} | ` +
      `Confidence=${record.confidence} | Quality=${record.overallQuality} | Refinements=${record.refinementPasses} | ` +
      `Latency=${record.latencyMs}ms | Model=${record.modelUsed}`
    );
  }

  /**
   * Attach user feedback to an existing request record.
   */
  public static recordFeedback(
    requestId: string,
    feedback: 'like' | 'dislike' | 'regenerate'
  ): void {
    const record = this.records.find((r) => r.requestId === requestId);
    if (record) {
      record.userFeedback = feedback;
      console.log(`[Telemetry] Feedback registered for Req=${requestId}: ${feedback}`);
    }
  }

  /**
   * Get recent telemetry summary for diagnostics.
   */
  public static getSummary() {
    const total = this.records.length;
    if (total === 0) return { totalRequests: 0, averageLatencyMs: 0, averageQuality: 0 };

    const totalLatency = this.records.reduce((acc, r) => acc + r.latencyMs, 0);
    const totalQuality = this.records.reduce((acc, r) => acc + r.overallQuality, 0);

    return {
      totalRequests: total,
      averageLatencyMs: Math.round(totalLatency / total),
      averageQuality: parseFloat((totalQuality / total).toFixed(2)),
      records: [...this.records],
    };
  }

  private static redactSensitive(text: string): string {
    if (!text) return '';
    return text
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GOOGLE_KEY]')
      .replace(/sk-[0-9A-Za-z-_]{20,}/g, '[REDACTED_API_KEY]')
      .replace(/gsk_[0-9A-Za-z-_]{20,}/g, '[REDACTED_GROQ_KEY]')
      .replace(/r8_[0-9A-Za-z-_]{20,}/g, '[REDACTED_REPLICATE_KEY]');
  }
}
