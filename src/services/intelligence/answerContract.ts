/**
 * src/services/intelligence/answerContract.ts
 *
 * Formulates the Answer Contract governing the response format, tone, depth,
 * and structural constraints. Ensures explicit user directives override generic defaults.
 */

import { IntentClassification, ComplexityEstimate, AnswerContract } from './types';

export class AnswerContractResolver {
  /**
   * Resolves explicit user constraints and default contract terms.
   */
  public static resolve(
    query: string,
    intent: IntentClassification,
    complexity: ComplexityEstimate,
    hasSources: boolean = false
  ): AnswerContract {
    const lower = query.toLowerCase();
    const constraints: string[] = [];

    // 1. Determine Tone & Depth
    let tone: 'concise' | 'balanced' | 'comprehensive' = 'balanced';
    let depth: 'surface' | 'standard' | 'deep' = 'standard';

    if (
      /\b(brief|short|concise|in one sentence|tldr|quick|in a few words|summarize in one line)\b/i.test(lower)
    ) {
      tone = 'concise';
      depth = 'surface';
      constraints.push('Keep response strictly concise and to the point.');
    } else if (
      /\b(detailed|in-depth|deep dive|comprehensive|thorough|step by step|explain fully)\b/i.test(lower) ||
      complexity.level === 'CRITICAL'
    ) {
      tone = 'comprehensive';
      depth = 'deep';
      constraints.push('Provide comprehensive coverage with clear explanations and context.');
    }

    // 2. Determine Format
    let format: 'prose' | 'bullet_points' | 'code_only' | 'table' | 'step_by_step' = 'prose';

    if (/\b(table|tabular format|in a table|matrix)\b/i.test(lower)) {
      format = 'table';
      constraints.push('Format primary output as a clean Markdown table.');
    } else if (/\b(bullet points?|bulleted|list format|list of)\b/i.test(lower)) {
      format = 'bullet_points';
      constraints.push('Format the answer using clean Markdown bullet points.');
    } else if (
      /\b(only code|just code|no explanation|code snippet only|without explanation)\b/i.test(lower)
    ) {
      format = 'code_only';
      constraints.push('Return ONLY the code block without conversational filler or introductory text.');
    } else if (/\b(step by step|guide|phases|steps to)\b/i.test(lower)) {
      format = 'step_by_step';
      constraints.push('Structure response into sequential numbered steps.');
    }

    // 3. Code & Example requirements
    const includeExamples =
      /\b(example|examples|sample|demonstrate|show how)\b/i.test(lower) ||
      intent.primaryIntent === 'coding' ||
      intent.primaryIntent === 'explanation';

    if (intent.primaryIntent === 'coding' && format !== 'code_only') {
      constraints.push('Provide working, runnable code with TypeScript types or standard error handling where relevant.');
    }

    // 4. Citation Requirements
    const strictCitationEnforcement = hasSources || intent.primaryIntent === 'research';
    if (strictCitationEnforcement) {
      constraints.push('Strictly ground facts in provided sources with [1], [2] citations. Never fabricate nonexistent links.');
    }

    return {
      tone,
      depth,
      format,
      includeExamples,
      strictCitationEnforcement,
      userSpecifiedConstraints: constraints,
    };
  }
}
