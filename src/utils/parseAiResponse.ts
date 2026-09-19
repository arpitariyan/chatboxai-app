/**
 * parseAiResponse
 *
 * Splits a raw LLM response string that may contain a <think>...</think>
 * reasoning block into two clean, separate pieces:
 *
 *  - `thinking`    : the raw reasoning trace (never includes the tags themselves)
 *  - `finalAnswer` : the clean prose answer the user should see
 *
 * Handles all edge-cases:
 *  1. No <think> at all   → thinking = '', finalAnswer = full text
 *  2. Properly closed tag → extracts reasoning + strips tag from answer
 *  3. Unclosed <think>    → heuristic: everything after a blank line
 *                           following the opening tag is treated as the
 *                           final answer; everything before is reasoning.
 *                           This prevents swallowing the final answer
 *                           when the model forgets </think>.
 */
export function parseAiResponse(aiResp: string): {
  thinking: string;
  finalAnswer: string;
} {
  if (!aiResp) return { thinking: '', finalAnswer: '' };

  // ── Case 1: Properly closed <think>...</think> ─────────────────────────────
  const closedMatch = aiResp.match(/^[\s\S]*?<think>([\s\S]*?)<\/think>([\s\S]*)$/i);
  if (closedMatch) {
    const thinking = closedMatch[1].trim();
    const finalAnswer = closedMatch[2]
      // Remove any remaining opening tags (safety)
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    return { thinking, finalAnswer };
  }

  // ── Case 2: Unclosed <think> — heuristic separation ───────────────────────
  if (/^[\s\S]*?<think>/i.test(aiResp)) {
    // Extract everything after the opening tag
    const afterTag = aiResp.replace(/^[\s\S]*?<think>/i, '');

    // Try to find a paragraph break that signals the model moved on to the
    // final answer (two or more newlines after at least one word of reasoning).
    // Example:  "<think>\nLet me think...\n\nHere is your answer.</think>"
    const paragraphBreak = afterTag.match(/^([\s\S]*?)\n\n+([\s\S]*)$/);
    if (paragraphBreak) {
      const thinkingPart = paragraphBreak[1].trim();
      const answerPart   = paragraphBreak[2].trim();
      // Only split if the supposed answer is non-trivially long (> 20 chars)
      if (answerPart.length > 20) {
        return { thinking: thinkingPart, finalAnswer: answerPart };
      }
    }

    // Fallback: treat everything as reasoning, final answer is empty
    return { thinking: afterTag.trim(), finalAnswer: '' };
  }

  // ── Case 3: No think tag at all ─────────────────────────────────────────
  return { thinking: '', finalAnswer: aiResp.trim() };
}
