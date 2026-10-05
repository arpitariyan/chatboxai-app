/**
 * parseAiResponse
 *
 * Splits a raw LLM response string that may contain a <think>...</think>
 * reasoning block and/or trailing markdown Sources/References sections
 * into clean, separate pieces:
 *
 *  - `thinking`        : the raw reasoning trace (never includes the tags themselves)
 *  - `finalAnswer`     : the clean prose answer the user should see
 *  - `extractedSources`: any source items extracted from trailing markdown sections
 */
export interface ExtractedSourceItem {
  id?: number;
  title: string;
  url: string;
}

export interface ParsedAiResponse {
  thinking: string;
  finalAnswer: string;
  extractedSources: ExtractedSourceItem[];
}

/**
 * Regex matching trailing sources / references / citations section:
 * Matches:
 *  - ### Sources / ## Sources / # Sources / Sources:
 *  - ### References / ## References / References:
 *  - ### Citations / ## Citations / Citations:
 *  - **Sources:** / **References:** / **Citations:**
 *  - Verified Sources / Sources Used / External Links
 * Followed by URL links or citation lists at the very end of the text.
 */
const TRAILING_SOURCES_REGEX =
  /(?:\r?\n)+(?:#{1,4}\s*(?:Sources|References|Citations|Verified\s+Sources|Sources\s+Used|External\s+Links)\s*:?|(?:\*\*|__)(?:Sources|References|Citations|Verified\s+Sources|External\s+Links):?(?:\*\*|__):?|(?:Sources|References|Citations):)\s*(?:\r?\n)+([\s\S]*?)(?:\r?\n\r?\n(?:✅\s*)?FINAL CONFIDENCE LEVEL:.*)?\s*$/i;

/**
 * Detects and strips any trailing Sources / References / Citations block
 * that an LLM might have appended at the end of its response, while preserving
 * and extracting any URLs and titles found in it.
 */
export function stripTrailingSources(text: string): {
  cleanText: string;
  extractedSources: ExtractedSourceItem[];
} {
  if (!text) return { cleanText: '', extractedSources: [] };

  const match = text.match(TRAILING_SOURCES_REGEX);
  if (!match) return { cleanText: text.trim(), extractedSources: [] };

  const sectionContent = match[1].trim();

  // Guard: Verify that sectionContent actually contains URLs or web links.
  // This prevents stripping legitimate topical headings like "### Sources of Vitamin C"
  if (!/https?:\/\//i.test(sectionContent)) {
    return { cleanText: text.trim(), extractedSources: [] };
  }

  const extractedSources: ExtractedSourceItem[] = [];
  const foundUrls = new Set<string>();

  // 1. Extract markdown links: [Title](https://...)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = mdLinkRegex.exec(sectionContent)) !== null) {
    const rawUrl = linkMatch[2].replace(/[.,;:)]$/, '');
    if (!foundUrls.has(rawUrl)) {
      foundUrls.add(rawUrl);
      extractedSources.push({
        id: extractedSources.length + 1,
        title: linkMatch[1].trim(),
        url: rawUrl,
      });
    }
  }

  // 2. Extract any bare URLs: https://...
  const bareUrlRegex = /(https?:\/\/[^\s\)\],]+)/g;
  let bareMatch: RegExpExecArray | null;
  while ((bareMatch = bareUrlRegex.exec(sectionContent)) !== null) {
    const rawUrl = bareMatch[1].replace(/[.,;:)]$/, '');
    if (!foundUrls.has(rawUrl)) {
      foundUrls.add(rawUrl);
      try {
        const domain = new URL(rawUrl).hostname.replace(/^www\./, '');
        extractedSources.push({
          id: extractedSources.length + 1,
          title: domain,
          url: rawUrl,
        });
      } catch {
        extractedSources.push({
          id: extractedSources.length + 1,
          title: 'Source',
          url: rawUrl,
        });
      }
    }
  }

  const cleanText = text.slice(0, match.index).trim();
  return { cleanText, extractedSources };
}

export function parseAiResponse(aiResp: string): ParsedAiResponse {
  if (!aiResp) return { thinking: '', finalAnswer: '', extractedSources: [] };

  let rawThinking = '';
  let rawAnswer = '';

  // ── Case 1: Closed <think>...</think>, <thought>...</thought>, or <reasoning>...</reasoning>
  const closedMatch = aiResp.match(/^[\s\S]*?<(?:think|thought|reasoning)>([\s\S]*?)<\/(?:think|thought|reasoning)>([\s\S]*)$/i);
  if (closedMatch) {
    rawThinking = closedMatch[1].trim();
    rawAnswer = closedMatch[2]
      .replace(/<(?:think|thought|reasoning)>[\s\S]*?<\/(?:think|thought|reasoning)>/gi, '')
      .trim();

    // If answer is empty or suspiciously short (< 20 chars) but thinking has substantial content,
    // the model likely included the answer inside the thinking block
    if (rawAnswer.length < 20 && rawThinking.length >= 20) {
      const internalBreak = rawThinking.match(/^([\s\S]*?)\n\n+((?:#{1,4}\s+|(?:\*\*|__)?[A-Z]|(?:In conclusion|To summarize|Summary|Therefore|Here is|So)[,\s\S])[\s\S]*)$/i);
      if (internalBreak && internalBreak[2].trim().length >= 20) {
        rawAnswer = internalBreak[2].trim();
        rawThinking = internalBreak[1].trim();
      } else {
        // Fall back to entire thinking content as the answer
        rawAnswer = rawThinking;
        rawThinking = '';
      }
    }
  } else if (/^[\s\S]*?<(?:think|thought|reasoning)>/i.test(aiResp)) {
    // ── Case 2: Unclosed tag — heuristic separation ───────────────────────
    const afterTag = aiResp.replace(/^[\s\S]*?<(?:think|thought|reasoning)>/i, '').trim();
    const paragraphBreak = afterTag.match(/^([\s\S]*?)\n\n+([\s\S]*)$/);
    if (paragraphBreak && paragraphBreak[2].trim().length > 20) {
      rawThinking = paragraphBreak[1].trim();
      rawAnswer = paragraphBreak[2].trim();
    } else {
      // NEVER discard content! If no clear break, afterTag IS the answer
      rawThinking = '';
      rawAnswer = afterTag;
    }
  } else {
    // ── Case 3: No think tag at all ─────────────────────────────────────────
    rawThinking = '';
    rawAnswer = aiResp.trim();
  }

  // ── Strip duplicate trailing Sources section from the answer body ──────────
  let { cleanText, extractedSources } = stripTrailingSources(rawAnswer);

  // Guarantee: if cleanText is empty but rawThinking has content, use rawThinking as answer
  if (!cleanText && rawThinking) {
    cleanText = rawThinking;
    rawThinking = '';
  }

  return {
    thinking: rawThinking,
    finalAnswer: cleanText,
    extractedSources,
  };
}
