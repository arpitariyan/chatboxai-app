/**
 * src/server/services/elevenlabs.ts
 *
 * ElevenLabs TTS Multi-Key Streaming Service.
 * Adapts website lib/voice/elevenlabs.ts and lib/voice/voice-registry.ts.
 * Supports automated cascading retry across multiple ElevenLabs API keys.
 */

import axios from 'axios';
import { logger } from '../lib/logger';

export interface AssistantVoice {
  id: 'voice-1' | 'voice-2' | 'voice-3' | 'voice-4' | 'voice-5' | string;
  name: string;
  voiceId: string;
  description: string;
  personality: string;
  gender: 'female' | 'male' | 'neutral';
  enabled: boolean;
  isDefault?: boolean;
}

export const ASSISTANT_VOICES: AssistantVoice[] = [
  {
    id: 'voice-1',
    name: 'Sarah',
    voiceId: process.env.ELEVENLABS_VOICE_1_ID || 'EXAVITQu4vr4xnSDxMaL',
    description: 'Warm & Natural',
    personality: 'Warm, calm, supportive, natural',
    gender: 'female',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'voice-2',
    name: 'Charlie',
    voiceId: process.env.ELEVENLABS_VOICE_2_ID || 'IKne3meq5aSn9XLyUdCD',
    description: 'Friendly & Casual',
    personality: 'Friendly, upbeat, casual, energetic',
    gender: 'male',
    enabled: true,
  },
  {
    id: 'voice-3',
    name: 'George',
    voiceId: process.env.ELEVENLABS_VOICE_3_ID || 'JBFqnCBsd6RMkjVDRZzb',
    description: 'Trusted & Confident',
    personality: 'Calm, reliable, confident, professional',
    gender: 'male',
    enabled: true,
  },
  {
    id: 'voice-4',
    name: 'Antoni',
    voiceId: process.env.ELEVENLABS_VOICE_4_ID || 'ErXwobaYiN019PkySvjV',
    description: 'Warm & Grounded',
    personality: 'Warm, mature, grounded, relaxed',
    gender: 'male',
    enabled: true,
  },
  {
    id: 'voice-5',
    name: 'Bill',
    voiceId: process.env.ELEVENLABS_VOICE_5_ID || 'pqHfZKP75CvOlQylNhV4',
    description: 'Helpful & Reassuring',
    personality: 'Helpful, gentle, reassuring, friendly',
    gender: 'male',
    enabled: true,
  },
];

export function getVoiceOptionById(optionId?: string): AssistantVoice {
  if (!optionId || typeof optionId !== 'string') {
    return ASSISTANT_VOICES[0];
  }

  const clean = optionId.trim().toLowerCase();
  const found = ASSISTANT_VOICES.find((v) => {
    if (!v.enabled) return false;
    return (
      v.id.toLowerCase() === clean ||
      v.name.toLowerCase() === clean ||
      v.voiceId.toLowerCase() === clean
    );
  });

  return found || ASSISTANT_VOICES[0];
}

let currentKeyIndex = 0;

export async function synthesizeElevenLabsAudio(params: {
  text: string;
  voiceId?: string;
  voiceOptionId?: string;
  modelId?: string;
}): Promise<Buffer> {
  const keys = [
    process.env.ELEVENLABS_API_KEY,
    process.env.ELEVENLABS_API_KEY_2,
    process.env.ELEVENLABS_API_KEY_3,
    process.env.ELEVENLABS_API_KEY_4,
    process.env.ELEVENLABS_API_KEY_5,
    process.env.ELEVENLABS_API_KEY_6,
    process.env.ELEVENLABS_API_KEY_7,
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    throw new Error('No ELEVENLABS_API_KEY is configured in the environment variables.');
  }

  // Resolve voice via allowlist registry
  const voiceOption = getVoiceOptionById(params.voiceOptionId || params.voiceId);
  const voiceId = voiceOption.voiceId;
  const modelId = params.modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voiceId
  )}/stream?output_format=mp3_44100_128`;

  const payload = {
    text: params.text,
    model_id: modelId,
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.80,
      style: 0.15,
      use_speaker_boost: true,
      speed: 1.0,
    },
  };

  let lastErrorMessage = '';

  for (let i = 0; i < keys.length; i++) {
    const activeIndex = (currentKeyIndex + i) % keys.length;
    const apiKey = keys[activeIndex];

    try {
      logger.info(`[ElevenLabs] Synthesizing speech with voice "${voiceOption.name}" using Key ${activeIndex + 1}/${keys.length}...`);
      const response = await axios.post(endpoint, payload, {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
        timeout: 20000,
      });

      if (response.status === 200 && response.data) {
        currentKeyIndex = activeIndex;
        return Buffer.from(response.data);
      }
    } catch (err: any) {
      const status = err.response?.status;
      let errMsg = err.message || 'Unknown network error';
      if (err.response?.data) {
        try {
          const parsed = JSON.parse(Buffer.from(err.response.data).toString('utf-8'));
          if (parsed?.detail?.message) errMsg = parsed.detail.message;
        } catch (_) {}
      }

      lastErrorMessage = `HTTP ${status}: ${errMsg}`;
      logger.warn(`[ElevenLabs] Key ${activeIndex + 1} failed (${status}): ${lastErrorMessage}`);

      // If quota (402), unauthorized (401), rate limited (429), or service unavailable (503), try next key
      if (status === 401 || status === 402 || status === 429 || status === 503) {
        currentKeyIndex = (activeIndex + 1) % keys.length;
        continue;
      }

      // If client error like 400 bad request, don't keep rotating keys
      if (status && status >= 400 && status < 500 && status !== 401 && status !== 402 && status !== 429) {
        throw new Error(`ElevenLabs error: ${lastErrorMessage}`);
      }
    }
  }

  throw new Error(`All configured ElevenLabs keys failed. Last error: ${lastErrorMessage}`);
}
