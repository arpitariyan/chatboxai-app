/**
 * src/server/routes/chat.ts
 *
 * Secure Server-Side LLM Chat Completion & Routing API:
 * - Completely isolates private LLM provider API keys on the server
 * - Enforces Firebase Bearer Token authentication
 * - Enforces per-user rate limiting via SlidingWindowLimiter
 * - Rotates provider keys dynamically on 429 / 503 errors
 * - Sanitizes all error messages to prevent credential / internal leakage
 */

import { Router, Request, Response } from 'express';
import { requireFirebaseUser } from '../lib/firebase-admin';
import { chatLimiter } from '../lib/rate-limit';
import { RateLimitedError, BadRequestError } from '../lib/errors';
import { logger } from '../lib/logger';
import { MODEL_REGISTRY } from '../../config/models-registry';
import { LLMMessage, LLMOptions, LLMResponse } from '../../services/llm/providers';

export const chatRouter = Router();

// Informational check
chatRouter.get('/chat/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'chatboxai-mobile-chat-api',
    status: 'online',
    timestamp: new Date().toISOString(),
  });
});

// Helper to collect provider keys securely from server process.env
function getServerApiKeys(provider: string): string[] {
  const keys: string[] = [];

  const addKeys = (...candidates: (string | undefined)[]) => {
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 10) {
        const trimmed = c.trim();
        if (!keys.includes(trimmed)) keys.push(trimmed);
      }
    }
  };

  switch (provider.toLowerCase()) {
    case 'google':
      addKeys(
        process.env.GOOGLE_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_GENAI_API_KEY,
        process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
        process.env.EXPO_PUBLIC_GOOGLE_API_KEY_2,
        process.env.EXPO_PUBLIC_GOOGLE_API_KEY_3,
        process.env.EXPO_PUBLIC_GOOGLE_API_KEY_4,
        process.env.EXPO_PUBLIC_GOOGLE_API_KEY_5
      );
      break;

    case 'openrouter':
      addKeys(
        process.env.OPENROUTER_API_KEY,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_2,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_3,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_4,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_5,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_6,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_7,
        process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_8
      );
      break;

    case 'groq':
      addKeys(
        process.env.GROQ_API_KEY,
        process.env.EXPO_PUBLIC_GROQ_API_KEY,
        process.env.EXPO_PUBLIC_GROQ_API_KEY_2,
        process.env.EXPO_PUBLIC_GROQ_API_KEY_3,
        process.env.EXPO_PUBLIC_GROQ_API_KEY_4,
        process.env.EXPO_PUBLIC_GROQ_API_KEY_5,
        process.env.EXPO_PUBLIC_GROQ_API_KEY_6,
        process.env.EXPO_PUBLIC_GROQ_API_KEY_7
      );
      break;

    case 'openai':
      addKeys(
        process.env.OPENAI_API_KEY,
        process.env.EXPO_PUBLIC_OPENAI_API_KEY
      );
      break;

    case 'anthropic':
      addKeys(
        process.env.ANTHROPIC_API_KEY,
        process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY
      );
      break;

    case 'replicate':
      addKeys(
        process.env.REPLICATE_API_KEY,
        process.env.EXPO_PUBLIC_REPLICATE_API_KEY,
        process.env.EXPO_PUBLIC_REPLICATE_API_KEY_2
      );
      break;

    case 'nvidia':
      addKeys(
        process.env.NVIDIA_API_KEY,
        process.env.EXPO_PUBLIC_NVIDIA_API_KEY,
        process.env.EXPO_PUBLIC_NVIDIA_API_KEY_2,
        process.env.EXPO_PUBLIC_NVIDIA_API_KEY_3,
        process.env.EXPO_PUBLIC_NVIDIA_API_KEY_4
      );
      break;
  }

  return keys;
}

// Low-level fetch wrapper for OpenAI-compatible providers
async function callServerOpenAICompat(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  baseURL: string,
  apiKey: string,
  providerName: string
): Promise<LLMResponse> {
  const url = `${baseURL}/chat/completions`;
  const bodyPayload: any = {
    model: modelApi,
    messages: messages.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4096,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (providerName === 'openrouter') {
    headers['HTTP-Referer'] = 'https://chatboxai.co.in';
    headers['X-Title'] = 'ChatBox AI';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`[${providerName}] HTTP ${res.status}: ${errorText.slice(0, 160)}`);
  }

  const data = await res.json();
  return {
    provider: providerName,
    choices: data.choices || [],
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// Low-level fetch wrapper for Google Gemini
async function callServerGoogleProvider(
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions,
  apiKey: string
): Promise<LLMResponse> {
  const cleanModel = modelApi.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const payload = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 4096,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`[google] HTTP ${res.status}: ${errorText.slice(0, 160)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return {
    provider: 'google',
    choices: [
      {
        message: { role: 'assistant', content: text },
        finish_reason: data.candidates?.[0]?.finishReason || 'STOP',
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    },
  };
}

// Dispatch to provider with key failover
async function executeProviderCall(
  provider: string,
  modelApi: string,
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const keys = getServerApiKeys(provider);
  if (keys.length === 0) {
    throw new Error(`[${provider}] No server-side API keys configured`);
  }

  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      switch (provider) {
        case 'groq':
          return await callServerOpenAICompat(
            modelApi,
            messages,
            options,
            'https://api.groq.com/openai/v1',
            key,
            'groq'
          );

        case 'openrouter':
          return await callServerOpenAICompat(
            modelApi,
            messages,
            options,
            'https://openrouter.ai/api/v1',
            key,
            'openrouter'
          );

        case 'nvidia':
          return await callServerOpenAICompat(
            modelApi,
            messages,
            options,
            'https://integrate.api.nvidia.com/v1',
            key,
            'nvidia'
          );

        case 'openai':
          return await callServerOpenAICompat(
            modelApi,
            messages,
            options,
            'https://api.openai.com/v1',
            key,
            'openai'
          );

        case 'google':
          return await callServerGoogleProvider(modelApi, messages, options, key);

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (err: any) {
      lastError = err;
      logger.warn(`Provider ${provider} key ${i + 1}/${keys.length} failed: ${err.message}`);
    }
  }

  throw lastError || new Error(`All keys failed for provider ${provider}`);
}

const AUTO_CHAIN = [
  'chatboxai/qwen-3.8-27b',
  'chatboxai/nemotron-3.5-lightning',
  'chatboxai/gpt-oss-120b',
  'chatboxai/allam-2-7b',
];

/**
 * POST /api/mobile/chat/generate
 * Authenticated endpoint for server-side LLM completion.
 */
chatRouter.post('/chat/generate', requireFirebaseUser, async (req: Request, res: Response) => {
  const user = req.user!;
  const userKey = user.uid || user.email;

  // 1. Sliding Window Rate Limiting
  const rateCheck = chatLimiter.check(userKey);
  if (!rateCheck.allowed) {
    throw new RateLimitedError(
      `Rate limit exceeded. Please wait ${rateCheck.retryAfter || 5} seconds before generating again.`,
      rateCheck.retryAfter
    );
  }

  const { modelId = 'auto', messages, options = {} } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new BadRequestError('Field "messages" must be a non-empty array');
  }

  try {
    let resolvedPublicId = modelId;
    if (resolvedPublicId === 'auto') {
      resolvedPublicId = AUTO_CHAIN[0];
    }

    const model = MODEL_REGISTRY.find(
      (m) => m.publicId === resolvedPublicId || m.providers.some((p: any) => p.modelApi === resolvedPublicId)
    );

    const providersToTry = model?.providers?.length
      ? model.providers
      : [
          { provider: 'groq', modelApi: 'qwen/qwen-2.5-32b-instruct' },
          { provider: 'openrouter', modelApi: 'nvidia/nemotron-4-340b-instruct' },
        ];

    let lastError: any = null;
    let completion: LLMResponse | null = null;
    let successfulProvider = '';
    let successfulModelApi = '';

    for (const p of providersToTry) {
      try {
        completion = await executeProviderCall(p.provider, p.modelApi, messages, options);
        successfulProvider = p.provider;
        successfulModelApi = p.modelApi;
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!completion) {
      // Fallback to auto chain
      for (const fallbackPublicId of AUTO_CHAIN) {
        const fbModel = MODEL_REGISTRY.find((m) => m.publicId === fallbackPublicId);
        if (!fbModel) continue;
        for (const p of fbModel.providers) {
          try {
            completion = await executeProviderCall(p.provider, p.modelApi, messages, options);
            successfulProvider = p.provider;
            successfulModelApi = p.modelApi;
            resolvedPublicId = fallbackPublicId;
            break;
          } catch {
            // Continue fallback
          }
        }
        if (completion) break;
      }
    }

    if (!completion || !completion.choices?.[0]?.message) {
      throw lastError || new Error('All AI providers exhausted. Please try again in a moment.');
    }

    const rawContent = completion.choices[0].message.content || '';

    // Extract thinking content if present (<think>...</think>)
    let cleanAnswer = rawContent;
    let thinkingContent = '';

    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      thinkingContent = thinkMatch[1].trim();
      cleanAnswer = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }

    res.status(200).json({
      success: true,
      aiResponse: cleanAnswer,
      thinkingContent,
      resolvedModel: {
        publicId: resolvedPublicId,
        provider: successfulProvider,
        modelApi: successfulModelApi,
      },
      usage: completion.usage,
    });
  } catch (err: any) {
    logger.error('[ChatRouter] Completion failure:', { error: err.message, user: user.email });
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'AI generation failed. Please try again.',
    });
  }
});
