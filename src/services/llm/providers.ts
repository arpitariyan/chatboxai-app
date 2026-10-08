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
        'Deliver a well-structured, clear, balanced, and complete response. Cover core aspects with helpful nuance and clear explanations without cutting off.'
      );
    case 'High':
      return (
        '\n\nEFFORT LEVEL: HIGH\n' +
        'Apply deep processing effort. Deliver a comprehensive, highly thorough, and complete response with structured explanations, relevant examples, edge case awareness, and clear verification without truncating.'
      );
    case 'Extra High':
      return (
        '\n\nEFFORT LEVEL: EXTRA HIGH\n' +
        'Apply maximum analytical rigor and exhaustive depth. Break down all components methodically, verify assumptions and edge cases, cover nuances, and provide an authoritative, impeccably structured and fully complete solution.'
      );
    case 'Low':
    default:
      return (
        '\n\nEFFORT LEVEL: STANDARD\n' +
        'Deliver a direct, well-structured, and complete response. Focus on clarity and accuracy while ensuring all aspects of the user inquiry are answered thoroughly.'
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
      'Provide ONLY the direct, high-quality, comprehensive final answer immediately.'
    );
  }

  // Thinking Mode is ON — intelligently scale reasoning depth based on complexity & effortLevel
  if (complexity === 'SIMPLE') {
    return (
      '\n\nTHINKING MODE: ENABLED (CONCISE MODE)\n' +
      'This is a simple or conversational query. Enclose a brief 1-2 sentence verification within <think> and </think> tags, ' +
      'then immediately output the closing </think> tag and provide your complete, direct final response. Do not over-elaborate the reasoning trace, and ensure your final response is full and complete.'
    );
  }

  if (complexity === 'COMPLEX' || effortLevel === 'High' || effortLevel === 'Extra High') {
    return (
      '\n\nTHINKING MODE: ENABLED (DEEP REASONING)\n' +
      'Before providing your final answer, conduct a thorough step-by-step reasoning analysis enclosed strictly within <think> and </think> tags.\n' +
      '- Analyze constraints, requirements, and edge cases\n' +
      '- Formulate and evaluate solutions methodically\n' +
      '- Verify logic, code, or factual claims before concluding\n' +
      'CRITICAL: You MUST output the closing </think> tag before writing your final response.\n' +
      'FINAL RESPONSE REQUIREMENT: Once </think> is closed, provide a complete, well-structured, and exhaustive answer. Do NOT stop prematurely or leave sentences/thoughts unfinished. Address all parts of the user request thoroughly.'
    );
  }

  // MODERATE complexity
  return (
    '\n\nTHINKING MODE: ENABLED\n' +
    'Before providing your final answer, write out a focused reasoning process enclosed strictly within <think> and </think> tags. ' +
    'Plan the structure and verify key details. CRITICAL: You MUST output the closing </think> tag before writing your final response.\n' +
    'FINAL RESPONSE REQUIREMENT: Once </think> is closed, provide a complete, well-structured final answer. Do NOT stop prematurely or leave thoughts unfinished. Ensure the response is comprehensive and fully answers the user.'
  );
}

// ── Smart Context Budgeting for Groq ─────────────────────────────────────────
// Groq enforces a strict 6,000 - 8,000 TPM and 7,000 ITPM limit across all free models.
// To guarantee zero 413 errors while keeping output headroom high, this budgets input messages to ~2,800 tokens.
export function budgetMessagesForGroq(messages: LLMMessage[]): LLMMessage[] {
  const MAX_INPUT_CHARS = 10000; // ~2,800 tokens

  const totalChars = messages.reduce((sum, m) => {
    return sum + (typeof m.content === 'string' ? m.content.length : 200);
  }, 0);

  if (totalChars <= MAX_INPUT_CHARS) {
    return messages;
  }

  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystemMsgs = messages.filter(m => m.role !== 'system');
  const latestMsg = nonSystemMsgs[nonSystemMsgs.length - 1];
  const historyMsgs = nonSystemMsgs.slice(0, -1);

  const budget: LLMMessage[] = [];
  let currentChars = 0;

  if (systemMsg) {
    const sysContent = typeof systemMsg.content === 'string' ? systemMsg.content : '';
    const trimmedSys = sysContent.length > 2200 ? sysContent.slice(0, 2200) + '... [search context trimmed]' : sysContent;
    budget.push({ role: 'system', content: trimmedSys });
    currentChars += trimmedSys.length;
  }

  const latestChars = typeof latestMsg?.content === 'string' ? latestMsg.content.length : 500;
  const remainingBudget = Math.max(1000, MAX_INPUT_CHARS - currentChars - latestChars);

  // Keep most recent history turns working backwards
  const keptHistory: LLMMessage[] = [];
  let historyChars = 0;
  for (let i = historyMsgs.length - 1; i >= 0; i--) {
    const h = historyMsgs[i];
    let contentStr = typeof h.content === 'string' ? h.content : '';
    if (contentStr.length > 800) {
      contentStr = contentStr.slice(0, 800) + '... [earlier turn truncated]';
    }
    if (historyChars + contentStr.length <= remainingBudget) {
      keptHistory.unshift({ role: h.role, content: contentStr });
      historyChars += contentStr.length;
    } else {
      break;
    }
  }

  budget.push(...keptHistory);
  if (latestMsg) {
    budget.push(latestMsg);
  }

  return budget;
}

// ── Resolve supported model parameters safely across providers ────────────────
export function resolveModelParameters(
  modelApi: string,
  options: LLMOptions
): { temperature?: number; max_tokens: number; top_p: number } {
  const effort = options.effortLevel || 'Low';

  let max_tokens = 4096;
  let temperature = 0.7;
  let top_p = 1.0;

  switch (effort) {
    case 'Low':
      max_tokens = 4096;
      temperature = 0.7;
      top_p = 1.0;
      break;
    case 'Medium':
      max_tokens = 4096;
      temperature = 0.65;
      top_p = 0.95;
      break;
    case 'High':
      max_tokens = 6144;
      temperature = 0.4;
      top_p = 0.9;
      break;
    case 'Extra High':
      max_tokens = 8192;
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

  // ── Prevent 413 / ITPM (Input Token Per Minute) rate limits on Groq ──
  // Groq's on-demand free tier enforces strict 6,000 - 8,000 TPM and 7,000 ITPM limits across all models.
  let finalMessages = formattedMessages;
  if (providerLabel === 'groq') {
    finalMessages = budgetMessagesForGroq(formattedMessages);
  }

  const modelParams = resolveModelParameters(modelApi, options);
  let resolvedMaxTokens = modelParams.max_tokens;

  if (providerLabel === 'groq') {
    const totalChars = finalMessages.reduce((sum, m) => {
      return sum + (typeof m.content === 'string' ? m.content.length : 200);
    }, 0);
    const approxPromptTokens = Math.ceil(totalChars / 3.5);

    // Groq free on-demand tier has a 7,800 TPM envelope with a 250 safety buffer = 7,550 total tokens.
    // Calculate available output tokens while guaranteeing at least 1,024 tokens for completion.
    const availableTokens = Math.max(1024, 7550 - approxPromptTokens);
    resolvedMaxTokens = Math.min(modelParams.max_tokens, availableTokens);
  }

  const payload: any = {
    model: modelApi,
    messages: finalMessages,
    max_tokens: resolvedMaxTokens,
    top_p: modelParams.top_p,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    stream: false,
  };

  if (modelParams.temperature !== undefined) {
    payload.temperature = modelParams.temperature;
  }

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  // If Groq returns 413 payload too large, automatically retry once with reduced max_tokens (website inngest pattern)
  if (!response.ok && response.status === 413 && providerLabel === 'groq' && resolvedMaxTokens > 1024) {
    const retriedMaxTokens = Math.max(1024, Math.floor(resolvedMaxTokens * 0.6));
    console.warn(`[ChatboxAI] [groq] 413 token limit, automatically retrying with safe max_tokens (${resolvedMaxTokens} -> ${retriedMaxTokens})...`);
    payload.max_tokens = retriedMaxTokens;
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  }

  // If OpenRouter returns 402 because requested tokens exceed affordable balance, retry with affordable tokens
  if (!response.ok && response.status === 402 && providerLabel.includes('openrouter')) {
    const errText = await response.text();
    const match = errText.match(/afford (\d+)/);
    const affordableTokens = match ? parseInt(match[1], 10) : 512;
    if (affordableTokens > 100 && payload.max_tokens > affordableTokens) {
      console.warn(`[ChatboxAI] [${providerLabel}] 402 credit limit, auto-retrying with affordable max_tokens (${payload.max_tokens} -> ${affordableTokens})...`);
      payload.max_tokens = Math.max(128, affordableTokens - 50);
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } else {
      throw new Error(`[${providerLabel}] API error: 402 ${errText}`);
    }
  }

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

export async function callReplicateProvider(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  apiKey: string
): Promise<LLMResponse> {
  const url = `https://api.replicate.com/v1/models/${modelApi}/predictions`;

  // 1. Build prompt and system prompt
  const effortSuffix = getEffortSystemSuffix(options.effortLevel);
  const thinkingSuffix = getThinkingModeSuffix(
    options.thinkingMode,
    options.queryComplexity || 'MODERATE',
    options.effortLevel || 'Low'
  );
  const existingSystem = messages.find(m => m.role === 'system');
  const systemBase = options.system || (existingSystem ? String(existingSystem.content) : '');
  const systemPrompt = (systemBase + effortSuffix + thinkingSuffix).trim();

  const nonSystem = messages.filter(m => m.role !== 'system');
  let prompt = '';
  let imageUrl: string | undefined = undefined;

  if (nonSystem.length === 1 && nonSystem[0].role === 'user') {
    const c = nonSystem[0].content;
    if (typeof c === 'string') {
      prompt = c;
    } else if (Array.isArray(c)) {
      const texts: string[] = [];
      for (const part of c) {
        if (part.type === 'text') texts.push(part.text);
        if (part.type === 'image_url' && !imageUrl) imageUrl = part.image_url.url;
      }
      prompt = texts.join('\n');
    }
  } else {
    const turns: string[] = [];
    for (const m of nonSystem) {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      const c = m.content;
      let text = '';
      if (typeof c === 'string') {
        text = c;
      } else if (Array.isArray(c)) {
        const parts: string[] = [];
        for (const p of c) {
          if (p.type === 'text') parts.push(p.text);
          if (p.type === 'image_url' && !imageUrl) imageUrl = p.image_url.url;
        }
        text = parts.join('\n');
      }
      turns.push(`${role}: ${text}`);
    }
    if (nonSystem[nonSystem.length - 1]?.role === 'user') {
      turns.push('Assistant:');
    }
    prompt = turns.join('\n\n');
  }

  const modelParams = resolveModelParameters(modelApi, options);
  // Replicate Anthropic/OpenAI schema requires integer max_tokens >= 1024
  const resolvedMaxTokens = Math.max(1024, modelParams.max_tokens);

  const inputPayload: Record<string, any> = {
    prompt,
  };

  if (systemPrompt) {
    inputPayload.system_prompt = systemPrompt;
  }

  // Model-specific parameter naming on Replicate
  if (modelApi.startsWith('openai/')) {
    inputPayload.max_completion_tokens = resolvedMaxTokens;
  } else {
    inputPayload.max_tokens = resolvedMaxTokens;
  }

  if (imageUrl) {
    inputPayload.image = imageUrl;
  }

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({ input: inputPayload }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`[replicate] API error: ${response.status} ${errorText}`);
  }

  let data = await response.json();

  // If status is starting or processing (long generation > 60s), poll urls.get
  let attempts = 0;
  while (
    (data.status === 'starting' || data.status === 'processing') &&
    data.urls?.get &&
    attempts < 40
  ) {
    await new Promise(r => setTimeout(r, 1500));
    const pollRes = await fetch(data.urls.get, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (pollRes.ok) {
      data = await pollRes.json();
    }
    attempts++;
  }

  if (data.status === 'failed' || data.status === 'canceled') {
    throw new Error(data.error || `[replicate] Prediction ${data.status}`);
  }

  let textContent = '';
  if (Array.isArray(data.output)) {
    textContent = data.output.join('');
  } else if (typeof data.output === 'string') {
    textContent = data.output;
  }

  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(textContent.length / 4);

  return {
    provider: 'replicate',
    choices: [{
      message: { role: 'assistant', content: textContent },
      finish_reason: 'stop',
      index: 0,
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
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
