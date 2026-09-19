import { EffortLevel } from '../../stores/useModelStore';

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

// ── Effort → system prompt suffix ─────────────────────────────────────────────
export function getEffortSystemSuffix(effortLevel?: EffortLevel): string {
  switch (effortLevel) {
    case 'Medium':
      return '\n\nThink carefully before responding. Consider different angles and be thorough.';
    case 'High':
      return '\n\nThink step-by-step and reason deeply. Consider multiple perspectives, potential edge cases, and verify your logic before responding. Be comprehensive and detailed.';
    case 'Extra High':
      return '\n\nApply maximum reasoning effort. Break down the problem methodically, explore all relevant angles, consider potential pitfalls, verify assumptions, and provide an exhaustive, well-structured response. Do not rush — prioritize accuracy and completeness over brevity.';
    case 'Low':
    default:
      return ''; // No suffix for Low
  }
}

// ── Thinking Mode → system prompt suffix ──────────────────────────────────────
export function getThinkingModeSuffix(thinkingMode?: boolean): string {
  if (thinkingMode) {
    return '\n\nTHINKING MODE ENABLED:\nYou are an advanced AI assistant. Before providing your final answer, you MUST write out your step-by-step reasoning process enclosed exactly within <think> and </think> tags. Keep your reasoning CONCISE to conserve tokens. CRITICAL: You MUST output the closing </think> tag before writing your final response. Do not skip this step. After the closing </think> tag, provide your final response following the Response Blueprint.';
  }
  return '\n\nReturn only the final answer.';
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
  const thinkingSuffix = getThinkingModeSuffix(options.thinkingMode);
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
  // Groq and NVIDIA APIs often reject massive base64 image payloads with 413 HTTP errors.
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
        
        // If only text is left, some strict APIs prefer string content over array
        if (filteredParts.every(p => p.type === 'text')) {
          formattedMessages[i].content = filteredParts.map(p => (p as {text: string}).text).join('');
        } else {
          formattedMessages[i].content = filteredParts;
        }
      }
    }
  }

  const payload = {
    model: modelApi,
    messages: formattedMessages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2048,
    top_p: options.top_p ?? 1.0,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    stream: false,
  };

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
  const thinkingSuffix = getThinkingModeSuffix(options.thinkingMode);
  const systemMessage = messages.find(m => m.role === 'system')?.content || options.system || '';
  const systemFull = String(systemMessage) + effortSuffix + thinkingSuffix;

  const payload: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 2048,
      topP: options.top_p ?? 1.0,
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
