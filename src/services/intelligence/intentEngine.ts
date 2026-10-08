/**
 * src/services/intelligence/intentEngine.ts
 *
 * High-performance, modular Intent Understanding Engine.
 * Classifies input into 15 canonical user intents, evaluates secondary traits,
 * and determines operational requirements (reasoning, search, files, code).
 */

import { UserIntent, IntentClassification } from './types';

interface IntentPattern {
  intent: UserIntent;
  weight: number;
  regexList: RegExp[];
  keywordList: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'general_chat',
    weight: 1.0,
    regexList: [
      /^(hi|hello|hey|greetings|good morning|good evening|good afternoon)\b/i,
      /^how are you( doing)?/i,
      /^(who are you|what is your name|what can you do)\b/i,
      /^(thank you|thanks|bye|goodbye|see you|ok|okay|cool|nice)\b/i,
    ],
    keywordList: ['hi', 'hello', 'hey', 'thanks', 'thank you', 'how are you', 'goodbye', 'bye'],
  },
  {
    intent: 'debugging',
    weight: 1.3,
    regexList: [
      /(error|exception|stack trace|failed to|cannot read properties|undefined is not|nullpointer)/i,
      /(fix this error|why is this failing|debug my code|troubleshoot this issue)/i,
      /(syntaxerror|typeerror|referenceerror|fatal error|segmentation fault)/i,
    ],
    keywordList: ['exception', 'stacktrace', 'traceback', 'debugging', 'fix bug', 'fails with', 'crash'],
  },
  {
    intent: 'coding',
    weight: 1.2,
    regexList: [
      /(write a (function|script|class|component|hook|query|api|regex|algorithm))/i,
      /(implement|create a snippet|build a|generate code for)/i,
      /(typescript|javascript|python|java|c\+\+|golang|rust|html|css|sql|react|vue|node)\b/i,
      /```[\s\S]*?```/,
    ],
    keywordList: ['code', 'function', 'class', 'method', 'refactor', 'typescript', 'algorithm', 'interface', 'async', 'promise'],
  },
  {
    intent: 'translation',
    weight: 1.2,
    regexList: [
      /(translate|translation|how to say .* in|in hindi|in spanish|in french|in german|in japanese)/i,
      /(convert to (english|hindi|spanish|french|german|mandarin))/i,
    ],
    keywordList: ['translate', 'translation', 'localize', 'meaning in hindi', 'translate into'],
  },
  {
    intent: 'summarization',
    weight: 1.1,
    regexList: [
      /(summarize|summary of|tldr|give me a tl;dr|condense this|key takeaways|bullet point summary)/i,
      /(brief overview of the following|short summary)/i,
    ],
    keywordList: ['summarize', 'summary', 'tldr', 'takeaways', 'briefly describe', 'condense'],
  },
  {
    intent: 'comparison',
    weight: 1.2,
    regexList: [
      /(compare .* (to|with|and)|differences? between|which is better|pros and cons of|vs\.?|versus)/i,
      /(trade-?offs between|compare and contrast)/i,
    ],
    keywordList: ['compare', 'versus', 'differences', 'tradeoffs', 'pros and cons', 'better option'],
  },
  {
    intent: 'planning',
    weight: 1.1,
    regexList: [
      /(plan|roadmap|step-by-step guide|itinerary|schedule|milestones|timeline|architecture plan)/i,
      /(how should i structure|design a system for|strategy for)/i,
    ],
    keywordList: ['roadmap', 'itinerary', 'timeline', 'action plan', 'milestone', 'strategy', 'architecture'],
  },
  {
    intent: 'research',
    weight: 1.2,
    regexList: [
      /(deep research|comprehensive report|in-depth analysis|literature review|market study)/i,
      /(historical background of|origins of|scientific evidence for|citations on)/i,
    ],
    keywordList: ['in-depth research', 'investigate', 'scientific study', 'whitepaper', 'market research', 'scholarly'],
  },
  {
    intent: 'explanation',
    weight: 1.0,
    regexList: [
      /(explain (to me )?(how|why|what)|eli5|explain like i am 5|help me understand|what does .* mean)/i,
      /(how does .* work|concept of|principle behind)/i,
    ],
    keywordList: ['explain', 'eli5', 'concept', 'intuition', 'how it works', 'principle'],
  },
  {
    intent: 'brainstorming',
    weight: 1.0,
    regexList: [
      /(brainstorm|give me (some )?ideas for|come up with|suggest names for|creative ways to)/i,
      /(what are some alternatives|inspire me with)/i,
    ],
    keywordList: ['brainstorm', 'ideas', 'suggestions', 'creative ideas', 'alternatives'],
  },
  {
    intent: 'writing',
    weight: 1.0,
    regexList: [
      /(write a (letter|email|essay|blog post|poem|story|speech|cover letter|proposal))/i,
      /(draft a message to|compose a)/i,
    ],
    keywordList: ['draft', 'write an essay', 'compose', 'cover letter', 'blog post', 'story'],
  },
  {
    intent: 'troubleshooting',
    weight: 1.1,
    regexList: [
      /(my (phone|device|wifi|bluetooth|screen|battery|system) is (not working|broken|lagging))/i,
      /(how to resolve issue|how to repair|diagnose)/i,
    ],
    keywordList: ['troubleshoot', 'not connecting', 'frozen', 'repair', 'diagnose', 'slow device'],
  },
  {
    intent: 'question_answering',
    weight: 0.9,
    regexList: [
      /^(what|who|where|when|which|why|how many|is it true that|can you tell me)\b/i,
      /\?$/,
    ],
    keywordList: ['what is', 'who is', 'where is', 'when was', 'how many', 'capital of', 'definition of'],
  },
];

export class IntentEngine {
  /**
   * Classify user query into primary and secondary intents.
   */
  public static classify(
    query: string,
    hasAttachments: boolean = false,
    hasImages: boolean = false
  ): IntentClassification {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();

    // 1. Check for file analysis or multimodal first if attachments exist
    if (hasImages) {
      return {
        primaryIntent: 'multimodal',
        confidence: 0.95,
        secondaryIntents: ['explanation', 'question_answering'],
        requiresWebSearch: false,
        requiresFileContext: true,
        requiresReasoning: true,
        hasCodeSnippet: false,
      };
    }

    if (hasAttachments) {
      return {
        primaryIntent: 'file_analysis',
        confidence: 0.95,
        secondaryIntents: ['summarization', 'question_answering'],
        requiresWebSearch: false,
        requiresFileContext: true,
        requiresReasoning: true,
        hasCodeSnippet: false,
      };
    }

    // 2. Check for explicit code snippet indicators
    const hasCodeSnippet =
      trimmed.includes('```') ||
      trimmed.includes('function(') ||
      trimmed.includes('const ') ||
      trimmed.includes('import ') ||
      trimmed.includes('class ') ||
      trimmed.includes('def ') ||
      trimmed.includes('=>');

    // 3. Score against pattern registry
    const scores = new Map<UserIntent, number>();

    for (const pattern of INTENT_PATTERNS) {
      let score = 0;

      // Regex matches
      for (const rx of pattern.regexList) {
        if (rx.test(trimmed)) {
          score += 4.0 * pattern.weight;
        }
      }

      // Keyword matches
      for (const kw of pattern.keywordList) {
        if (lower.includes(kw)) {
          score += 1.5 * pattern.weight;
        }
      }

      if (score > 0) {
        scores.set(pattern.intent, score);
      }
    }

    // Boost coding or debugging if actual code snippets are present
    if (hasCodeSnippet) {
      const currentDebug = scores.get('debugging') || 0;
      const currentCode = scores.get('coding') || 0;
      if (lower.includes('error') || lower.includes('fail') || lower.includes('bug')) {
        scores.set('debugging', currentDebug + 6.0);
      } else {
        scores.set('coding', currentCode + 5.0);
      }
    }

    // Sort by highest score
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

    const primaryIntent: UserIntent = sorted.length > 0 ? sorted[0][0] : 'question_answering';
    const topScore = sorted.length > 0 ? sorted[0][1] : 1.0;
    const confidence = Math.min(0.99, Math.max(0.65, topScore / 10.0));

    const secondaryIntents: UserIntent[] = sorted
      .slice(1, 3)
      .map(([intent]) => intent);

    // Operational requirements determination
    const requiresReasoning = [
      'coding',
      'debugging',
      'comparison',
      'planning',
      'research',
    ].includes(primaryIntent);

    const requiresWebSearch =
      lower.includes('latest') ||
      lower.includes('current') ||
      lower.includes('today') ||
      lower.includes('news') ||
      lower.includes('2026') ||
      lower.includes('recent') ||
      primaryIntent === 'research';

    return {
      primaryIntent,
      confidence: parseFloat(confidence.toFixed(2)),
      secondaryIntents: secondaryIntents.length > 0 ? secondaryIntents : undefined,
      requiresWebSearch,
      requiresFileContext: hasAttachments,
      requiresReasoning,
      hasCodeSnippet,
    };
  }
}
