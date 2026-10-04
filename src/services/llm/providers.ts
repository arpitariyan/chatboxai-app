import { EffortLevel } from '../../stores/useModelStore';
import { QueryComplexity } from '../search/queryPlanner';

// Content can be a string or a multimodal array (for vision models)
export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  system?: string;
  effortLevel?: EffortLevel;
  thinkingMode?: boolean;
  queryComplexity?: QueryComplexity;
}

export interface LLMResponse {
  provider: string;
  choices: {
    message: { role: string; content: string };
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ── Effort → system prompt guidance ──────────────────────────────────────────
export function getEffortSystemSuffix(effortLevel?: EffortLevel): string {
  switch (effortLevel) {
    case 'Medium':
      return (
        '\n\nEFFORT LEVEL: MEDIUM\n' +
        'Deliver a well-structured, clear, and balanced response. Cover the core aspects with helpful nuance.'
      );
    case 'High':
      return (
        '\n\nEFFORT LEVEL: HIGH\n' +
        'Apply deep processing effort. Deliver a comprehensive, highly thorough response with structured explanations, relevant examples, edge case awareness, and clear verification.'
      );
    case 'Extra High':
      return (
        '\n\nEFFORT LEVEL: EXTRA HIGH\n' +
        'Apply maximum analytical rigor and exhaustive depth. Break down all components methodically, verify assumptions and edge cases, cover nuances, and provide an authoritative, impeccably structured solution.'
      );
    case 'Low':
    default:
      return (
        '\n\nEFFORT LEVEL: LOW\n' +
        'Be fast, concise, and direct. Focus on clarity and brevity without unnecessary filler.'
      );
  }
}

// ── Thinking Mode → system prompt directive ──────────────────────────────────
export function getThinkingModeSuffix(
  thinkingMode?: boolean,
  complexity: QueryComplexity = 'MODERATE',
  effortLevel: EffortLevel = 'Low'
): string {
  if (thinkingMode === false) {
    return (
      '\n\nTHINKING MODE: DISABLED\n' +
      'Do NOT output any thinking process, internal monologue, reasoning steps, or <think> tags. ' +
      'Provide ONLY the direct, high-quality final answer immediately.'
    );
  }

  // Thinking Mode is ON — intelligently scale reasoning depth based on complexity & effortLevel
  if (complexity === 'SIMPLE') {
    return (
      '\n\nTHINKING MODE: ENABLED (CONCISE MODE)\n' +
      'This is a simple or conversational query. Enclose a brief 1-2 sentence verification within <think> and </think> tags, ' +
      'then immediately output the closing </think> tag and provide your direct final response. Do not over-elaborate the reasoning trace.'
    );
  }

  if (complexity === 'COMPLEX' || effortLevel === 'High' || effortLevel === 'Extra High') {
    return (
      '\n\nTHINKING MODE: ENABLED (DEEP REASONING)\n' +
      'Before providing your final answer, conduct a thorough step-by-step reasoning analysis enclosed strictly within <think> and </think> tags.\n' +
      '- Analyze constraints, requirements, and edge cases\n' +
      '- Formulate and evaluate solutions methodically\n' +
      '- Verify logic, code, or factual claims before concluding\n' +
      'CRITICAL: You MUST output the closing </think> tag before writing your final response. Keep the final response completely separate from the thinking trace.'
    );
  }

  // MODERATE complexity
  return (
    '\n\nTHINKING MODE: ENABLED\n' +
    'Before providing your final answer, write out a focused reasoning process enclosed strictly within <think> and </think> tags. ' +
    'Plan the structure and verify key details. CRITICAL: You MUST output the closing </think> tag before writing your final response.'
  );
}

// ── Resolve supported model parameters safely across providers ────────────────
export function resolveModelParameters(
  modelApi: string,
  options: LLMOptions
): { temperature?: number; max_tokens: number; top_p: number } {
  const effort = options.effortLevel || 'Low';

  let max_tokens = 2048;
  let temperature = 0.7;
  let top_p = 1.0;

  switch (effort) {
    case 'Low':
      max_tokens = 1536;
      temperature = 0.7;
      top_p = 1.0;
      break;
    case 'Medium':
      max_tokens = 2560;
      temperature = 0.6;
      top_p = 0.95;
      break;
    case 'High':
      max_tokens = 4096;
      temperature = 0.4;
      top_p = 0.9;
      break;
    case 'Extra High':
      max_tokens = 6144;
      temperature = 0.2;
      top_p = 0.85;
      break;
  }

  // Allow explicit caller overrides
  if (options.max_tokens !== undefined) max_tokens = options.max_tokens;
  if (options.temperature !== undefined) temperature = options.temperature;
  if (options.top_p !== undefined) top_p = options.top_p;

  // Strict reasoning models (e.g. OpenAI o1/o3) reject custom temperature with HTTP 400
  const lowerApi = modelApi.toLowerCase();
  const isStrictReasoning = lowerApi.startsWith('o1') || lowerApi.startsWith('o3');

  if (isStrictReasoning) {
    return { max_tokens, top_p };
  }

  return { temperature, max_tokens, top_p };
}

export async function callOpenAICompat(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  baseURL: string,
  apiKey: string,
  providerLabel: string
): Promise<LLMResponse> {
  const url = `${baseURL}/chat/completions`;

  const formattedMessages = [...messages];

  // Build system content, injecting effort and thinking suffix
  const effortSuffix = getEffortSystemSuffix(options.effortLevel);
  const thinkingSuffix = getThinkingModeSuffix(
    options.thinkingMode,
    options.queryComplexity || 'MODERATE',
    options.effortLevel || 'Low'
  );
  const existingSystem = formattedMessages.find(m => m.role === 'system');
  const systemBase = options.system || (existingSystem ? String(existingSystem.content) : '');

  if (systemBase || effortSuffix || thinkingSuffix) {
    // Remove existing system message if present, then prepend enriched one
    const filtered = formattedMessages.filter(m => m.role !== 'system');
    filtered.unshift({ role: 'system', content: systemBase + effortSuffix + thinkingSuffix });
    formattedMessages.length = 0;
    formattedMessages.push(...filtered);
  }

  // ── Prevent 413 Payload Too Large on text-only providers ──
  const isStrictProvider = providerLabel === 'groq' || providerLabel === 'nvidia';
  const isVisionModel = modelApi.toLowerCase().includes('vision');

  if (isStrictProvider && !isVisionModel) {
    for (let i = 0; i < formattedMessages.length; i++) {
      if (Array.isArray(formattedMessages[i].content)) {
        const parts = formattedMessages[i].content as LLMContentPart[];
        const filteredParts = parts.filter(p => p.type !== 'image_url');
        
        if (filteredParts.length < parts.length) {
          filteredParts.push({ 
            type: 'text', 
            text: '\n[Note: Image attachments were stripped because this model/provider does not support vision]' 
          });
        }
        
        if (filteredParts.every(p => p.type === 'text')) {
          formattedMessages[i].content = filteredParts.map(p => (p as {text: string}).text).join('');
        } else {
          formattedMessages[i].content = filteredParts;
        }
      }
    }
  }

  const modelParams = resolveModelParameters(modelApi, options);

  const payload: any = {
    model: modelApi,
    messages: formattedMessages,
    max_tokens: modelParams.max_tokens,
    top_p: modelParams.top_p,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    stream: false,
  };

  if (modelParams.temperature !== undefined) {
    payload.temperature = modelParams.temperature;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[${providerLabel}] API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    provider: providerLabel,
    choices: data.choices.map((c: any) => ({
      message: { role: c.message.role, content: c.message.content },
      finish_reason: c.finish_reason,
      index: c.index,
    })),
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      total_tokens: data.usage?.total_tokens ?? 0,
    },
  };
}

export async function callGoogleProvider(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  apiKey: string
): Promise<LLMResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelApi}:generateContent?key=${apiKey}`;

  const contents = messages
    .filter(m => m.role !== 'system')
    .map((m) => {
      // Convert multimodal content for Google format
      if (Array.isArray(m.content)) {
        const parts = m.content.map(part => {
          if (part.type === 'text') return { text: part.text };
          if (part.type === 'image_url') {
            // Google expects inlineData for base64 images
            const url = part.image_url.url;
            if (url.startsWith('data:')) {
              const [header, data] = url.split(',');
              const mimeType = header.split(':')[1].split(';')[0];
              return { inlineData: { mimeType, data } };
            }
            return { text: `[Image: ${url}]` };
          }
          return { text: '' };
        });
        return { role: m.role === 'user' ? 'user' : 'model', parts };
      }
      return {
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content as string }],
      };
    });

  // Build system instruction with effort and thinking suffix
  const effortSuffix = getEffortSystemSuffix(options.effortLevel);
  const thinkingSuffix = getThinkingModeSuffix(
    options.thinkingMode,
    options.queryComplexity || 'MODERATE',
    options.effortLevel || 'Low'
  );
  const systemMessage = messages.find(m => m.role === 'system')?.content || options.system || '';
  const systemFull = String(systemMessage) + effortSuffix + thinkingSuffix;

  const modelParams = resolveModelParameters(modelApi, options);

  const payload: any = {
    contents,
    generationConfig: {
      temperature: modelParams.temperature ?? 0.7,
      maxOutputTokens: modelParams.max_tokens,
      topP: modelParams.top_p,
    },
  };

  if (systemFull.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemFull }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[google] API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    provider: 'google',
    choices: [{
      message: { role: 'assistant', content: textContent },
      finish_reason: data.candidates?.[0]?.finishReason ?? 'stop',
      index: 0,
    }],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: data.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}
