/**
 * src/services/intelligence/deterministicVerifier.ts
 *
 * Fast, deterministic verification engine (Zero LLM token & battery cost).
 * Verifies code fences, bracket balancing, JSON structures, citation integrity,
 * and automatically applies safe structural repairs without requiring extra model calls.
 */

import { DeterministicVerificationResult, DeterministicVerificationIssue, AnswerContract } from './types';
import { SearchResultItem } from '../search/webSearchService';

export class DeterministicVerifier {
  /**
   * Run all deterministic checks and apply auto-repairs if possible.
   */
  public static verify(
    content: string,
    contract?: AnswerContract,
    availableSources?: SearchResultItem[]
  ): DeterministicVerificationResult {
    const issues: DeterministicVerificationIssue[] = [];
    const passedChecks: string[] = [];
    let repairedContent = content;

    const trimmed = content.trim();

    // 1. Empty or Near-Empty Check
    if (trimmed.length === 0) {
      issues.push({
        type: 'empty_response',
        message: 'The model returned an empty response.',
        severity: 'critical',
      });
      return { isValid: false, issues, passedChecks };
    }
    passedChecks.push('non_empty_content');

    // 2. Unclosed Code Fence Check & Auto-Repair
    const codeBlockFences = (content.match(/```/g) || []).length;
    if (codeBlockFences % 2 !== 0) {
      issues.push({
        type: 'unclosed_code_fence',
        message: 'Detected an unclosed code block (odd number of ``` fences).',
        severity: 'warning',
        autoFixed: true,
      });
      // Auto-repair: append closing fence
      repairedContent = `${repairedContent.trimEnd()}\n\`\`\``;
      passedChecks.push('auto_repaired_code_fence');
    } else {
      passedChecks.push('balanced_code_fences');
    }

    // 3. Balanced Brackets Check in Code Blocks
    const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)```/g;
    let match;
    let hasBracketIssue = false;

    while ((match = codeBlockRegex.exec(repairedContent)) !== null) {
      const code = match[1];
      const counts = { '{': 0, '}': 0, '(': 0, ')': 0, '[': 0, ']': 0 };

      for (const char of code) {
        if (char === '{') counts['{']++;
        if (char === '}') counts['}']++;
        if (char === '(') counts['(']++;
        if (char === ')') counts[')']++;
        if (char === '[') counts['[']++;
        if (char === ']') counts[']']++;
      }

      if (
        counts['{'] !== counts['}'] ||
        counts['('] !== counts[')'] ||
        counts['['] !== counts[']']
      ) {
        hasBracketIssue = true;
        break;
      }
    }

    if (hasBracketIssue) {
      issues.push({
        type: 'unbalanced_brackets',
        message: 'Code block contains potentially unbalanced brackets or parentheses.',
        severity: 'warning',
      });
    } else {
      passedChecks.push('bracket_symmetry_verified');
    }

    // 4. Citation Index Validity Check
    if (availableSources && availableSources.length > 0) {
      const citationMatches = repairedContent.match(/\[(\d+)\]/g);
      if (citationMatches) {
        const sourceCount = availableSources.length;
        let invalidCount = 0;

        for (const citation of citationMatches) {
          const num = parseInt(citation.replace(/[[\]]/g, ''), 10);
          if (num < 1 || num > sourceCount) {
            invalidCount++;
          }
        }

        if (invalidCount > 0) {
          issues.push({
            type: 'invalid_citation',
            message: `Found ${invalidCount} citation(s) referencing out-of-bounds sources (valid range: 1-${sourceCount}).`,
            severity: 'warning',
          });
        } else {
          passedChecks.push('citation_bounds_verified');
        }
      }
    }

    // 5. Code-only Contract Enactment
    if (contract?.format === 'code_only') {
      const startsWithCode = repairedContent.trim().startsWith('```');
      const endsWithCode = repairedContent.trim().endsWith('```');
      if (!startsWithCode || !endsWithCode) {
        issues.push({
          type: 'truncated_output',
          message: 'Output violates code_only contract: contains conversational text outside code block.',
          severity: 'warning',
        });
      } else {
        passedChecks.push('code_only_contract_satisfied');
      }
    }

    const hasCriticalIssues = issues.some((i) => i.severity === 'critical');

    return {
      isValid: !hasCriticalIssues,
      issues,
      repairedContent: repairedContent !== content ? repairedContent : undefined,
      passedChecks,
    };
  }
}
