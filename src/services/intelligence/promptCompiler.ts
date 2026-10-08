/**
 * src/services/intelligence/promptCompiler.ts
 *
 * Modular Prompt Compiler.
 * Composes precise runtime system instructions from orthogonal policies.
 * Eliminates monolithic hardcoded prompt strings.
 */

import { IntentClassification, AnswerContract, ComplexityEstimate } from './types';
import { SearchResultItem } from '../search/webSearchService';

export interface PromptCompilerOptions {
  intent: IntentClassification;
  contract: AnswerContract;
  complexity: ComplexityEstimate;
  sources?: SearchResultItem[];
  userPreferences?: {
    language?: string;
    chatFont?: string;
    memoryEnabled?: boolean;
    userProfileName?: string;
  };
  customDirectives?: string[];
}

export class PromptCompiler {
  private static readonly BASE_POLICY =
    'You are ChatBox AI, a high-intelligence, reliable, and precise AI assistant. ' +
    'Provide helpful, directly actionable, and well-structured responses. ' +
    'Never generate repetitive fluff or patronizing conversational filler.';

  private static readonly TASK_POLICIES: Record<string, string> = {
    general_chat:
      'Engage naturally, courteously, and concisely. Keep responses conversational and appropriate to the tone.',
    question_answering:
      'Provide a direct, accurate answer to the question first, followed by relevant context if helpful.',
    coding:
      'You are a senior software architect. Provide clean, secure, idiomatic, and modern code. ' +
      'Include TypeScript types or appropriate standard language patterns. Include comments only where logic is non-obvious. ' +
      'Do not truncate code blocks with placeholders like "// rest of code goes here".',
    debugging:
      'Diagnose the root cause of the error clearly and succinctly. ' +
      'Show the exact minimal fix and explain why the bug occurred, along with preventative advice.',
    research:
      'Provide an objective, evidence-based analysis. Distinguish between verified empirical facts and speculative claims. ' +
      'Highlight trade-offs, limitations, and methodological nuances.',
    explanation:
      'Deconstruct complex principles into intuitive concepts using clear analogies before introducing formal definitions.',
    summarization:
      'Condense the source material faithfully. Capture critical facts, figures, and actionable conclusions without altering original meaning.',
    translation:
      'Translate accurately preserving nuances, idiomatic expressions, cultural tone, and original formatting.',
    writing:
      'Craft engaging, well-paced prose aligned with the requested style, voice, and target audience.',
    planning:
      'Create realistic, well-ordered action plans with clear phases, dependencies, milestones, and risk mitigations.',
    comparison:
      'Deliver an objective, criteria-driven comparison highlighting strengths, weaknesses, and optimal decision criteria.',
    brainstorming:
      'Generate diverse, high-value, and creative possibilities categorized by feasibility and impact.',
    troubleshooting:
      'Provide a logical troubleshooting sequence from simplest/most probable cause to advanced diagnostics.',
    multimodal:
      'Analyze the provided image thoroughly. Describe key visual elements, text, diagrams, and answer questions accurately.',
    file_analysis:
      'Extract facts strictly grounded in the uploaded file content. If a detail is missing from the document, explicitly acknowledge that.',
  };

  /**
   * Compiles complete system instruction from modular policies.
   */
  public static compile(options: PromptCompilerOptions): string {
    const blocks: string[] = [this.BASE_POLICY];

    // 1. Task Policy
    const taskPolicy =
      this.TASK_POLICIES[options.intent.primaryIntent] ||
      this.TASK_POLICIES.question_answering;
    blocks.push(`### TASK OBJECTIVE\n${taskPolicy}`);

    // 2. Answer Contract Directives
    const contractBlocks: string[] = [];
    if (options.contract.tone === 'concise') {
      contractBlocks.push('- BREVITY: Be strictly concise and direct.');
    } else if (options.contract.tone === 'comprehensive') {
      contractBlocks.push('- THOROUGHNESS: Provide comprehensive, detailed explanations.');
    }

    if (options.contract.format === 'code_only') {
      contractBlocks.push('- FORMAT: Output ONLY executable code in fenced blocks. No introductory or trailing chat.');
    } else if (options.contract.format === 'table') {
      contractBlocks.push('- FORMAT: Structure the primary output as a well-aligned Markdown table.');
    } else if (options.contract.format === 'bullet_points') {
      contractBlocks.push('- FORMAT: Structure information using clean, readable bullet points.');
    } else if (options.contract.format === 'step_by_step') {
      contractBlocks.push('- FORMAT: Use sequential numbered steps with clear subheadings.');
    }

    for (const c of options.contract.userSpecifiedConstraints) {
      contractBlocks.push(`- USER CONSTRAINT: ${c}`);
    }

    if (contractBlocks.length > 0) {
      blocks.push(`### ANSWER CONTRACT\n${contractBlocks.join('\n')}`);
    }

    // 3. Grounding & Citations Directive
    if (options.sources && options.sources.length > 0) {
      const sourceList = options.sources
        .slice(0, 6)
        .map((s, idx) => {
          const desc = (s.description || s.content || '').trim().slice(0, 320);
          return `[${idx + 1}] ${s.title}\n${desc}\nSource: ${s.url}`;
        })
        .join('\n\n');

      blocks.push(
        `### LIVE SEARCH GROUNDING\n` +
        `You have access to the verified live search results below. ` +
        `Strictly ground your factual statements in these sources and cite them inline using [1], [2], etc.\n` +
        `Do not fabricate imaginary sources or hallucinate URLs not provided below:\n\n${sourceList}`
      );
    }

    // 4. Safety & Hallucination Prevention Directive
    blocks.push(
      '### ACCURACY & FACTUAL INTEGRITY\n' +
      '- Never guess or invent facts if unsure; state uncertainty clearly.\n' +
      '- Never fabricate code libraries, APIs, or URLs.\n' +
      '- Maintain rigorous safety: avoid dangerous, harmful, or unethical instructions.'
    );

    // 5. User Preferences
    if (options.userPreferences?.userProfileName) {
      blocks.push(`Address the user appropriately if relevant (${options.userPreferences.userProfileName}).`);
    }

    // 6. Custom Directives
    if (options.customDirectives && options.customDirectives.length > 0) {
      blocks.push(`### SPECIAL INSTRUCTIONS\n${options.customDirectives.join('\n')}`);
    }

    return blocks.join('\n\n');
  }
}
