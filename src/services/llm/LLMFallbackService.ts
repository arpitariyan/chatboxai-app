import { LLMMessage, LLMOptions, LLMResponse, callGoogleProvider, callOpenAICompat } from './providers';
import { MODEL_REGISTRY } from '../../config/models-registry';

// ── Auto-select fallback chain ───────────────────────────────────────────────
const AUTO_CHAIN = [
  'chatboxai/gpt-oss-20b',          // Groq — fast & high quality
  'chatboxai/qwen-3.8-27b',         // Groq — reliable fallback
  'chatboxai/allam-2-7b',           // Groq — lightest fallback
];

export class LLMFallbackService {
  private static getApiKeys(provider: string): string[] {
    const keys: string[] = [];
    switch (provider) {
      case 'google':
        [
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_2,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_3,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_4,
          process.env.EXPO_PUBLIC_GOOGLE_API_KEY_5,
        ].forEach(k => { if (k && k.trim() !== '') keys.push(k.trim()); });
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
        ].forEach(k => { if (k && k.trim() !== '') keys.push(k.trim()); });
        break;
      case 'replicate':
        [
          process.env.EXPO_PUBLIC_REPLICATE_API_KEY,
          process.env.EXPO_PUBLIC_REPLICATE_API_KEY_2,
        ].forEach(k => { if (k && k.trim() !== '') keys.push(k.trim()); });
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
        ].forEach(k => { if (k && k.trim() !== '') keys.push(k.trim()); });
        break;
      case 'anthropic':
        if (process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY) keys.push(process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY);
        break;
      case 'openai':
        if (process.env.EXPO_PUBLIC_OPENAI_API_KEY) keys.push(process.env.EXPO_PUBLIC_OPENAI_API_KEY);
        break;
      case 'nvidia':
        [
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY,
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY_2,
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY_3,
          process.env.EXPO_PUBLIC_NVIDIA_API_KEY_4,
        ].forEach(k => { if (k && k.trim() !== '') keys.push(k.trim()); });
        break;
    }
    return keys;
  }

  private static async callProvider(provider: string, modelApi: string, messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    const keys = this.getApiKeys(provider);
    if (keys.length === 0) {
      throw new Error(`[${provider}] API keys not configured in environment.`);
    }

    let lastError: any = null;

    for (const key of keys) {
      try {
        switch (provider) {
          case 'openai':
            return await callOpenAICompat(modelApi, messages, options, 'https://api.openai.com/v1', key, 'openai');
          case 'groq':
            return await callOpenAICompat(modelApi, messages, options, 'https://api.groq.com/openai/v1', key, 'groq');
          case 'openrouter':
            return await callOpenAICompat(modelApi, messages, options, 'https://openrouter.ai/api/v1', key, 'openrouter');
          case 'replicate':
            return await callOpenAICompat(modelApi, messages, options, 'https://openai-compat.replicate.com/v1', key, 'replicate');
          case 'nvidia':
            return await callOpenAICompat(modelApi, messages, options, 'https://integrate.api.nvidia.com/v1', key, 'nvidia');
          case 'google':
            return await callGoogleProvider(modelApi, messages, options, key);
          default:
            throw new Error(`Unknown provider: "${provider}"`);
        }
      } catch (error: any) {
        lastError = error;
        // Silently catch and try the next key. Do not use console.warn or console.log 
        // as they can trigger the LogBox warning UI in Expo during development.
      }
    }
    
    // Fallback logic specific to Replicate -> OpenRouter (inherited from website)
    if (provider === 'replicate') {
      console.log(`[replicate] Keys failed or missing, trying OpenRouter fallback as per website configuration.`);
      const orKeys = this.getApiKeys('openrouter');
      for (const orKey of orKeys) {
        try {
           return await callOpenAICompat(modelApi, messages, options, 'https://openrouter.ai/api/v1', orKey, 'openrouter-fallback');
        } catch (err: any) {
           lastError = err;
        }
      }
    }

    throw lastError;
  }

  public static async routeRequest(publicId: string, messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse & { resolvedModel: any }> {
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
      throw new Error(`Model "${publicId}" not found in registry.`);
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

    throw new Error(`All providers failed for model "${publicId}".\n${errors.join('\n')}`);
  }
}
