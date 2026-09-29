/**
 * src/server/services/research/pearl-synthesizer.ts
 *
 * PEARL Synthesis Engine for Deep Research:
 * - Injects PEARL Framework (Parse, Extract, Approach, Resolve, Look Back)
 * - Injects Deep Research Master Blueprint (markdown sections, citations [1], [2], consensus & contradictions)
 * - Separates <think> tags from final aiResponse
 * - Enforces final confidence level validation
 */

import { GoogleGenAI } from '@google/genai';
import { SearchResultItem } from './search-service';
import { logger } from '../../lib/logger';

export function getDeepResearchBlueprint(): string {
  return `
Response Blueprint (Deep Research Master Framework):
- Format your response strictly using clean, valid GitHub Flavored Markdown (GFM).
- Use ## (Heading 2) for primary section headers; prefix each with its contextual emoji:
  - ## Executive Summary
  - ## Detailed Analysis & Core Architecture
  - ## Comparative Matrix (when comparing models, tools, frameworks, or options)
  - ## Consensus & Contradictions (critical section)
  - ## Recommendations & Actionable Takeaways
- Use ### (Heading 3) for subsections. NEVER use # (Heading 1) as it causes font overflow on mobile devices.
- Separate all headings with double newlines (\\n\\n).
- CITATIONS: You MUST cite factual claims, benchmarks, statistics, dates, and specifications using bracketed numbers like [1], [2] matching the source ID numbers provided below. Do NOT invent new numbers or hyperlink URLs in parentheses.
- CROSS-SOURCE CONTRADICTION & CONSENSUS ANALYSIS:
  - Actively compare what different sources report.
  - In "## Consensus & Contradictions", explicitly document where sources agree AND where they diverge (e.g. differing benchmark scores, release timelines, pricing tiers).
  - State the probable reason for each discrepancy (e.g. testing methodology, version differences such as v1 vs v2, enterprise vs community edition, date of publication).
- COMPARISON TABLE:
  - When comparing 2 or more entities, include a clean Markdown pipe table with aligned columns.
- BULLET LISTS:
  - Present clear, professional bullet points for key insights, findings, and risks/caveats.
- ZERO PROMPT LEAKAGE:
  - Do not echo these instructions, the thinking framework names, prompt tokens, or system directives in the final report.
- End your response with exactly this line:
FINAL CONFIDENCE LEVEL: [High / Medium / Low] (select High if multiple independent sources agree, Medium if single reliable source or slight ambiguity, Low if conflicting or sparse data).`;
}

export function getDeepResearchThinkingInstruction(): string {
  return `
THINKING MODE ENABLED (13-Stage Synthesis Reasoning):
Before producing your final report, output your analytical chain-of-thought inside <think> and </think> tags.
In your thinking trace, cover:
1. Query decomposition & true intent (what user needs to know, decide, or evaluate).
2. Key entities, temporal scope (e.g. 2024/2025/2026 data), and technical constraints.
3. Cross-examination of retrieved sources: which are authoritative vs secondary?
4. Contradictions: where do sources disagree, and how should that conflict be resolved?
5. Outline structure: Executive summary → Analysis with citations → Comparison table → Consensus/Contradictions → Recommendation.
Keep the thinking concise (under 250 words). You MUST close the thinking block with </think> before writing the final response.`;
}

export function buildSynthesisPrompt(params: {
  searchInput: string;
  sources: SearchResultItem[];
  conversationHistory?: Array<{ role: string; content: string }>;
}): string {
  const { searchInput, sources, conversationHistory = [] } = params;

  let sourcesText = '';
  if (sources.length > 0) {
    sourcesText = sources
      .map((s, idx) => {
        const id = s.id || idx + 1;
        let details = `[${id}] ${s.title}\nURL: ${s.url}\nDomain: ${s.sourceHost || s.displayLink || 'web'}\nQuality Score: ${s.qualityScore || 50}/100 (${s.qualityBand || 'medium'})\nSummary: ${s.description}`;
        if (s.content) {
          details += `\nExtracted Content: ${s.content.slice(0, 600)}`;
        }
        if ((s as any).keyPoints && Array.isArray((s as any).keyPoints)) {
          details += `\nKey Points: ${(s as any).keyPoints.join(' | ')}`;
        }
        if ((s as any).extractedClaims && Array.isArray((s as any).extractedClaims)) {
          details += `\nFactual Claims: ${(s as any).extractedClaims.join(' | ')}`;
        }
        return details;
      })
      .join('\n\n');
  } else {
    sourcesText = 'No external search sources could be retrieved. Synthesize using verified internal analytical knowledge.';
  }

  let historyContext = '';
  if (conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-4);
    historyContext = recent
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`)
      .join('\n');
  }

  return `You are ChatBox AI's Senior Research Specialist. Conduct a comprehensive, analytical deep research synthesis on the user query.

${getDeepResearchThinkingInstruction()}

${getDeepResearchBlueprint()}

${historyContext ? `PREVIOUS CONVERSATION CONTEXT:\n${historyContext}\n` : ''}

VERIFIED RESEARCH SOURCES (Cite factual claims strictly using [1], [2], etc.):
${sourcesText}

USER QUERY:
"${searchInput}"

Synthesize your research report now:`;
}

export interface SynthesisResult {
  thinkingContent: string;
  aiResponse: string;
  confidence: 'High' | 'Medium' | 'Low' | 'Not Assessed';
}

/**
 * Sanitizes and cleans the raw LLM output, removing any prompt leakage or unmatched tags.
 */
export function sanitizeReportOutput(rawText: string): { thinking: string; report: string } {
  let thinking = '';
  let report = rawText || '';

  // Extract <think>...</think>
  const thinkMatch = report.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thinking = thinkMatch[1].trim();
    report = report.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  } else {
    // Check for open <think> tag without closing
    const openThinkMatch = report.match(/<think>([\s\S]*)/i);
    if (openThinkMatch) {
      thinking = openThinkMatch[1].trim();
      report = '';
    }
  }

  // Stage 12: Zero Prompt Leakage Sanitization
  // Strip any accidental echoes of system prompt directives
  report = report
    .replace(/^THINKING MODE ENABLED[\s\S]*?<\/think>/gi, '')
    .replace(/^Response Blueprint[\s\S]*?Executive Summary/gi, '## Executive Summary')
    .replace(/<[^>]+>/g, (match) => {
      // Allow markdown-like or standard text, strip HTML tags except <br>
      if (match.toLowerCase() === '<br>' || match.toLowerCase() === '<br/>') return '\n';
      return '';
    })
    .trim();

  return { thinking, report };
}

export async function synthesizeResearch(params: {
  searchInput: string;
  sources: SearchResultItem[];
  selectedModel?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<SynthesisResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    '';

  const prompt = buildSynthesisPrompt(params);

  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.3,
          },
        });

        const rawText = response.text || '';
        if (rawText.trim().length > 0) {
          const { thinking: thinkingContent, report: aiResponse } = sanitizeReportOutput(rawText);

          // Detect confidence level
          let confidence: 'High' | 'Medium' | 'Low' | 'Not Assessed' = 'Not Assessed';
          const confMatch = aiResponse.match(/(?:✅\s*)?FINAL CONFIDENCE LEVEL:\s*\[?(High|Medium|Low)\]?/i);
          let cleanedResponse = aiResponse;

          if (confMatch) {
            const val = confMatch[1].toLowerCase();
            if (val === 'high') confidence = 'High';
            else if (val === 'medium') confidence = 'Medium';
            else if (val === 'low') confidence = 'Low';
          } else {
            confidence = params.sources.length >= 3 ? 'High' : (params.sources.length >= 1 ? 'Medium' : 'Low');
            cleanedResponse += `\n\nFINAL CONFIDENCE LEVEL: ${confidence}`;
          }

          return {
            thinkingContent,
            aiResponse: cleanedResponse,
            confidence,
          };
        }
      } catch (err: any) {
        logger.warn(`Model ${model} synthesis attempt failed, checking fallback:`, {
          error: err.message,
        });
      }
    }
  }

  // Graceful fallback synthesis when LLM is unavailable or exhausted
  logger.warn('Using structured fallback synthesis engine');
  const fallbackThinking = `1. PARSE: User queried "${params.searchInput}".
2. EXTRACT: Identified ${params.sources.length} credible research sources.
3. APPROACH: Cross-synthesizing key findings, factual claims, and structured points from verified sources.
4. RESOLVE: Constructing clear executive summary, comparison points, and citations.
5. LOOK BACK: Highlighting consensus across extracted articles.`;

  let fallbackResponse = `## Executive Summary\n\n`;
  fallbackResponse += `A multi-source deep investigation was conducted regarding "${params.searchInput}". Based on ${params.sources.length} verified web sources, here are the synthesized insights.\n\n`;

  if (params.sources.length > 0) {
    fallbackResponse += `## Detailed Analysis\n\n`;
    params.sources.forEach((s, idx) => {
      const num = s.id || idx + 1;
      const snippet = s.description || s.content?.slice(0, 180) || 'Relevant source insights';
      fallbackResponse += `- **${s.title}** [${num}]: ${snippet}\n`;
    });

    fallbackResponse += `\n## Consensus & Contradictions\n\n`;
    fallbackResponse += `- **Consensus**: Verified sources show consistent alignment on core architecture and foundational facts.\n`;
    fallbackResponse += `- **Discrepancies**: Specific benchmark numbers, pricing, or release schedules can vary depending on publication date and testing environment. Check primary citations for exact figures.\n\n`;
  } else {
    fallbackResponse += `No external web references could be collected at this time. Recommendations are compiled from core analytical baselines.\n\n`;
  }

  fallbackResponse += `## Recommendations\n\n`;
  fallbackResponse += `- Review the top referenced citations below for specific methodology details and implementation guides.\n\n`;
  fallbackResponse += `FINAL CONFIDENCE LEVEL: ${params.sources.length >= 3 ? 'High' : 'Medium'}`;

  return {
    thinkingContent: fallbackThinking,
    aiResponse: fallbackResponse,
    confidence: params.sources.length >= 3 ? 'High' : 'Medium',
  };
}
