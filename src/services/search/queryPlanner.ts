/**
 * src/services/search/queryPlanner.ts
 *
 * Query complexity assessment and search query formulation.
 * Works seamlessly with Thinking Mode, Effort levels, and Web Search:
 * - Accurately categorizes queries to prevent over-processing simple questions
 * - Formulates targeted, noise-free search queries from conversational prompts
 */

export type QueryComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX';

export interface QueryAnalysis {
  complexity: QueryComplexity;
  complexityScore: number; // 0 to 100
  cleanSearchQuery: string;
  isConversational: boolean;
  needsDeepReasoning: boolean;
}

const GREETINGS_AND_CHITCHAT = new Set([
  'hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon',
  'how are you', 'how are you doing', 'who are you', 'what is your name',
  'what can you do', 'help', 'thanks', 'thank you', 'bye', 'goodbye',
  'ok', 'okay', 'cool', 'nice', 'awesome', 'great', 'sure', 'yes', 'no'
]);

const COMPLEX_TRIGGERS = [
  // Programming & Engineering
  'code', 'function', 'class', 'bug', 'debug', 'error', 'exception', 'stack trace',
  'algorithm', 'regex', 'sql', 'query', 'database', 'schema', 'api', 'endpoint',
  'refactor', 'typescript', 'javascript', 'python', 'react', 'async', 'promise',
  'concurrency', 'deadlock', 'optimization', 'architecture', 'microservice',
  
  // Math, Logic & Science
  'calculate', 'solve', 'equation', 'integral', 'derivative', 'probability',
  'theorem', 'proof', 'deduce', 'logic puzzle', 'step by step', 'evaluate',
  
  // Analytical & Comparative
  'compare and contrast', 'trade-offs', 'in-depth analysis', 'benchmark',
  'pros and cons', 'implications', 'root cause', 'methodology'
];

const CONVERSATIONAL_PREFIXES = [
  /^can you (please )?(tell|show|explain|help|give|find|search for)(\s+me)?\s+/i,
  /^please (tell|show|explain|help|give|find|search for)(\s+me)?\s+/i,
  /^could you (please )?(tell|show|explain|help)(\s+me)?\s+/i,
  /^i want to know (about)?\s+/i,
  /^do you know (about)?\s+/i,
  /^tell me (about)?\s+/i,
  /^search for\s+/i,
  /^look up\s+/i,
  /^what is the latest (on|about)\s+/i,
  /^what (is|are|was|were) (the\s+)?/i,
  /^who (is|are|was|were) (the\s+)?/i,
  /^where (is|are) (the\s+)?/i,
  /^when (is|was|were|did) (the\s+)?/i,
  /^give me (a|an|the)\s+/i,
  /^how (to|do|does|can) (we|you|i\s+)?/i,
];

/**
 * Analyzes the user's input to determine complexity and formulate optimal search queries.
 */
export function analyzeUserQuery(input: string): QueryAnalysis {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check for basic conversational chitchat
  const cleanPunctuation = lower.replace(/[!?.,;]/g, '').trim();
  if (GREETINGS_AND_CHITCHAT.has(cleanPunctuation) || trimmed.length <= 4) {
    return {
      complexity: 'SIMPLE',
      complexityScore: 10,
      cleanSearchQuery: trimmed,
      isConversational: true,
      needsDeepReasoning: false,
    };
  }

  // 2. Score complexity based on intent, triggers, and structure
  let score = 25; // baseline

  // Length factor
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 40) score += 20;
  else if (wordCount > 20) score += 10;
  else if (wordCount < 6) score -= 10;

  // Code or formatting indicators
  if (trimmed.includes('```') || trimmed.includes('{') || trimmed.includes('=>') || trimmed.includes('def ')) {
    score += 35;
  }

  // Complex trigger keywords (matched as whole words)
  let triggerCount = 0;
  for (const trigger of COMPLEX_TRIGGERS) {
    const rx = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(lower)) {
      triggerCount++;
      score += 15;
    }
  }

  // Explanatory / conceptual markers (MODERATE intent)
  const explanatoryMarkers = ['explain', 'summarize', 'overview', 'how does', 'how do', 'why is', 'why do', 'why does', 'history of', 'guide'];
  for (const marker of explanatoryMarkers) {
    const rx = new RegExp(`\\b${marker}\\b`, 'i');
    if (rx.test(lower)) {
      score += 15;
      break;
    }
  }

  // Multi-step markers
  if (lower.includes('1.') || lower.includes('firstly') || lower.includes('step 1') || lower.includes('and also')) {
    score += 15;
  }

  const finalScore = Math.min(Math.max(score, 5), 100);

  let complexity: QueryComplexity = 'MODERATE';
  if (finalScore < 35) {
    complexity = 'SIMPLE';
  } else if (finalScore >= 60 || triggerCount >= 2) {
    complexity = 'COMPLEX';
  }

  // 3. Formulate clean search query for web search retrieval
  let cleanQuery = trimmed;
  for (const prefix of CONVERSATIONAL_PREFIXES) {
    if (prefix.test(cleanQuery)) {
      cleanQuery = cleanQuery.replace(prefix, '').trim();
      break;
    }
  }

  // Remove trailing conversational punctuation and phrases
  cleanQuery = cleanQuery
    .replace(/[?]+$/, '')
    .replace(/^(about|regarding)\s+/i, '')
    .trim();

  // Fallback to original if stripping emptied the query
  if (!cleanQuery) cleanQuery = trimmed;

  return {
    complexity,
    complexityScore: finalScore,
    cleanSearchQuery: cleanQuery,
    isConversational: cleanPunctuation.length < 20 && triggerCount === 0,
    needsDeepReasoning: complexity === 'COMPLEX',
  };
}
