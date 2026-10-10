import { LLMMessage, LLMOptions, LLMResponse, callGoogleProvider, callOpenAICompat, callReplicateProvider } from './providers';
import { MODEL_REGISTRY } from '../../config/models-registry';
import { apiClient } from '../api/client';
import { getEncryptedVaultKeys } from '../security/encryptedKeyVault';

// ── Auto-select fallback chain (Prioritizing high-context, verified working models) ───────
const AUTO_CHAIN = [
  'chatboxai/qwen-3.8-27b',           // Groq (qwen3.8-27b) -> OpenRouter Nemotron
  'chatboxai/nemotron-3.5-lightning', // OpenRouter (1M context free)
  'chatboxai/gpt-oss-120b',          // Groq (120B) -> OpenRouter Nemotron
  'chatboxai/allam-2-7b',            // Groq (allam-2-7b)
];

export class LLMFallbackService {
  private static deadKeys: Set<string> = new Set<string>();

  private static getApiKeys(provider: string): string[] {
    const rawKeys: string[] = [];
    switch (provider) {
      case 'google':
        [
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_2,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_3,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_4,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_5,
        ].forEach(k => { if (k && k.trim() !== '') rawKeys.push(k.trim()); });
        if (rawKeys.length === 0) {
          rawKeys.push(...getEncryptedVaultKeys('google'));
        }
        break;
      case 'openrouter':
        [
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_2,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_3,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_4,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_5,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_6,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_7,
          process.env.EXPO_PUBLIC_OPENROUTER_API_KEY_8,
        ].forEach(k => { if (k && k.trim() !== '') rawKeys.push(k.trim()); });
        if (rawKeys.length === 0) {
          rawKeys.push(...getEncryptedVaultKeys('openrouter'));
        }
        break;
      case 'replicate':
        [
          process.env.EXPO_PUBLIC_REPLICATE_API_KEY,
          process.env.EXPO_PUBLIC_REPLICATE_API_KEY_2,
        ].forEach(k => { if (k && k.trim() !== '') rawKeys.push(k.trim()); });
        if (rawKeys.length === 0) {
          rawKeys.push(...getEncryptedVaultKeys('replicate'));
        }
        break;
      case 'groq':
        [
          process.env.EXPO_PUBLIC_GROQ_API_KEY,
          process.env.EXPO_PUBLIC_GROQ_API_KEY_2,
          process.env.EXPO_PUBLIC_GROQ_API_KEY_3,
          process.env.EXPO_PUBLIC_GROQ_API_KEY_4,
          process.env.EXPO_PUBLIC_GROQ_API_KEY_5,
          process.env.EXPO_PUBLIC_GROQ_API_KEY_6,
          process.env.EXPO_PUBLIC_GROQ_API_KEY_7,
        ].forEach(k => { if (k && k.trim() !== '') rawKeys.push(k.trim()); });
        if (rawKeys.length === 0) {
          rawKeys.push(...getEncryptedVaultKeys('groq'));
        }
        break;
      case 'anthropic':
        if (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) rawKeys.push(process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY);
        break;
      case 'openai':
        if (process.env.EXPO_PUBLIC_OPENAI_API_KEY) rawKeys.push(process.env.EXPO_PUBLIC_OPENAI_API_KEY);
        break;
      case 'nvidia':
        [
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY,
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY_2,
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY_3,
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY_4,
        ].forEach(k => { if (k && k.trim() !== '') rawKeys.push(k.trim()); });
        if (rawKeys.length === 0) {
          rawKeys.push(...getEncryptedVaultKeys('nvidia'));
        }
        break;
    }
    // Filter out permanently dead keys to avoid repeating wasted roundtrips
    return rawKeys.filter(k => !this.deadKeys.has(k));
  }

  private static async callProvider(provider: string, modelApi: string, messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    const keys = this.getApiKeys(provider);
    if (keys.length === 0) {
      throw new Error(`[${provider}] No active API keys available (unconfigured or all marked dead).`);
    }

    let lastError: any = null;

    // Loop sequentially through each available API key for this provider.
    // If Key 1 throws any temporary error (e.g. 429 rate limit, 503),
    // it automatically shifts to Key 2, Key 3, up to Key N.
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        console.log(`[ChatboxAI] [${provider}] Attempting with Key ${i + 1}/${keys.length} for "${modelApi}"...`);
        let response: LLMResponse;
        switch (provider) {
          case 'openai':
            response = await callOpenAICompat(modelApi, messages, options, 'https://api.openai.com/v1', key, 'openai');
            break;
          case 'groq':
            response = await callOpenAICompat(modelApi, messages, options, 'https://api.groq.com/openai/v1', key, 'groq');
            break;
          case 'openrouter':
            response = await callOpenAICompat(modelApi, messages, options, 'https://openrouter.ai/api/v1', key, 'openrouter');
            break;
          case 'replicate':
            response = await callReplicateProvider(modelApi, messages, options, key);
            break;
          case 'nvidia':
            response = await callOpenAICompat(modelApi, messages, options, 'https://integrate.api.nvidia.com/v1', key, 'nvidia');
            break;
          case 'google':
            response = await callGoogleProvider(modelApi, messages, options, key);
            break;
          default:
            throw new Error(`Unknown provider: "${provider}"`);
        }

        if (i > 0) {
          console.log(`[ChatboxAI] [${provider}] Key ${i + 1}/${keys.length} succeeded!`);
        }
        return response;
      } catch (error: any) {
        lastError = error;
        const rawMsg = error?.message || String(error);
        const cleanMsg = rawMsg.length > 80 ? rawMsg.slice(0, 80) + '...' : rawMsg;

        // Check if key is permanently blocked/leaked/suspended
        const isPermanentKeyError =
          rawMsg.includes('API_KEY_SERVICE_BLOCKED') ||
          rawMsg.includes('leaked') ||
          rawMsg.includes('API key not valid') ||
          rawMsg.includes('suspended');

        if (isPermanentKeyError) {
          this.deadKeys.add(key);
          console.warn(`[ChatboxAI] [${provider}] Key marked as permanently dead due to fatal auth error: ${cleanMsg}`);
        }

        // Check if the model itself does not exist on this provider
        const isModelNotFound =
          rawMsg.includes('404') ||
          rawMsg.includes('model_not_found') ||
          rawMsg.includes('does not exist') ||
          rawMsg.includes('unavailable for free');

        if (isModelNotFound) {
          console.warn(`[ChatboxAI] [${provider}] Model "${modelApi}" does not exist (404). Fast-shifting to next provider without exhausting keys.`);
          break; // Stop trying more keys of the same provider for a non-existent model!
        }

        if (i + 1 < keys.length) {
          console.log(`[ChatboxAI] [${provider}] Key ${i + 1}/${keys.length} failed (${cleanMsg}). Shifting to Key ${i + 2}/${keys.length}...`);
        } else {
          console.log(`[ChatboxAI] [${provider}] All ${keys.length} keys exhausted for "${modelApi}".`);
        }
      }
    }
    
    // Fallback logic specific to Replicate -> OpenRouter (inherited from website)
    if (provider === 'replicate') {
      console.log(`[replicate] Keys failed or missing, trying OpenRouter fallback as per website configuration.`);
      const orKeys = this.getApiKeys('openrouter');
      const safeOptions: LLMOptions = {
        ...options,
        max_tokens: Math.min(options.max_tokens || 4096, 800),
      };
      for (let j = 0; j < orKeys.length; j++) {
        try {
          return await callOpenAICompat(modelApi, messages, safeOptions, 'https://openrouter.ai/api/v1', orKeys[j], 'openrouter-fallback');
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    throw lastError;
  }

  public static async routeRequest(publicId: string, messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse & { resolvedModel: any; thinkingContent?: string }> {
    // 1. Primary: Dedicated Secure Server-Side Proxy (Zero Provider Keys In APK)
    try {
      const serverRes = await apiClient.post('/api/mobile/chat/generate', {
        modelId: publicId || 'auto',
        messages,
        options,
      });

      if (serverRes.data?.success && serverRes.data.aiResponse) {
        return {
          provider: serverRes.data.resolvedModel?.provider || 'server',
          choices: [
            {
              message: { role: 'assistant', content: serverRes.data.aiResponse },
              finish_reason: 'STOP',
              index: 0,
            },
          ],
          usage: serverRes.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          resolvedModel: serverRes.data.resolvedModel || { publicId, provider: 'server', modelApi: publicId },
          thinkingContent: serverRes.data.thinkingContent,
        };
      }
    } catch (serverErr: any) {
      const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : false;
      // In production release builds, do not fall back to local exposed keys; throw clean error
      if (!isDev) {
        throw new Error(serverErr.response?.data?.error || serverErr.message || 'AI service temporarily unavailable.');
      }
      console.warn('[LLMFallbackService] Secure server proxy unreachable, using local dev fallback:', serverErr.message);
    }

    // ── Auto: try the priority fallback chain
    if (!publicId || publicId === 'auto') {
      for (const fallbackId of AUTO_CHAIN) {
        try {
          return await this.routeRequest(fallbackId, messages, options);
        } catch (err: any) {
          console.log(`[ChatboxAI] Auto fallback "${fallbackId}" failed:`, err.message);
        }
      }
      throw new Error('All auto-fallback models failed. Please specify a model.');
    }

    // ── Resolve model from registry
    const model = MODEL_REGISTRY.find(m => m.publicId === publicId || m.providers.some((p: any) => p.modelApi === publicId));
    if (!model || !model.providers?.length) {
      // If requested model isn't in registry, route to auto chain
      console.warn(`[ChatboxAI] Model "${publicId}" not found in registry. Falling back to default.`);
      return await this.routeRequest('auto', messages, options);
    }

    // ── Try each provider in order (primary → fallbacks)
    const errors: string[] = [];
    for (const { provider, modelApi } of model.providers) {
      try {
        console.log(`[ChatboxAI] Routing "${publicId}" → ${provider} (${modelApi})`);
        const result = await this.callProvider(provider, modelApi, messages, options);
        return {
          ...result,
          resolvedModel: { publicId, provider, modelApi }
        };
      } catch (err: any) {
        console.log(`[ChatboxAI] Provider "${provider}" failed for "${publicId}":`, err.message);
        errors.push(`${provider}: ${err.message}`);
      }
    }

    // ── Multi-Layer Resilient Fallback ──────────────────────────────────────────
    // If all providers for this specific model failed (e.g. Google 403 API_KEY_SERVICE_BLOCKED
    // or Groq 413 token limit), seamlessly try the reliable models from AUTO_CHAIN so
    // the user NEVER gets an ugly technical crash error.
    if (!AUTO_CHAIN.includes(publicId)) {
      console.warn(`[ChatboxAI] All providers failed for "${publicId}". Engaging automatic resilient fallback...`);
      for (const fallbackId of AUTO_CHAIN) {
        try {
          console.log(`[ChatboxAI] Resilient fallback "${publicId}" → "${fallbackId}"`);
          return await this.routeRequest(fallbackId, messages, options);
        } catch (fbErr: any) {
          console.warn(`[ChatboxAI] Resilient fallback "${fallbackId}" failed:`, fbErr.message);
        }
      }
    }

    throw new Error(`All providers failed for model "${publicId}".\n${errors.join('\n')}`);
  }
}
