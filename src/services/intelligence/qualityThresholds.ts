/**
 * src/services/intelligence/qualityThresholds.ts
 *
 * Configurable Quality Thresholds by user intent and task complexity.
 * Prevents premature acceptance of low-quality answers while avoiding endless loops.
 */

import { UserIntent } from './types';

export const TASK_QUALITY_THRESHOLDS: Record<UserIntent, number> = {
  general_chat: 0.80,
  question_answering: 0.84,
  coding: 0.90,
  debugging: 0.90,
  research: 0.88,
  comparison: 0.85,
  explanation: 0.84,
  summarization: 0.85,
  translation: 0.85,
  writing: 0.80,
  planning: 0.85,
  brainstorming: 0.80,
  troubleshooting: 0.86,
  multimodal: 0.85,
  file_analysis: 0.88,
};

export function getQualityThreshold(intent: UserIntent, isHighComplexity: boolean = false): number {
  const base = TASK_QUALITY_THRESHOLDS[intent] || 0.84;
  return isHighComplexity ? Math.min(0.95, base + 0.04) : base;
}
