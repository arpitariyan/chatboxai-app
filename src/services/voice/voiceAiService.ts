/**
 * src/services/voice/voiceAiService.ts
 *
 * Voice AI Pipeline & Playback Engine.
 * Handles the complete conversational flow:
 *   User speaks -> Groq Whisper transcription -> Voice AI LLM response -> ElevenLabs TTS -> Audio Playback.
 * Includes interruption handling, real-time audio level simulation, and fallback speech synthesis.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { requireOptionalNativeModule } from 'expo';
import { resolveBackendBaseUrl } from '../../config/mobileApi';
import { auth } from '../../config/firebase';
import { LLMFallbackService } from '../llm/LLMFallbackService';
import { preprocessTextForTTS } from './voicePreprocess';

// ── Safe dynamic loader for expo-audio ───────────────────────────────────────
type ExpoAudioModuleType = typeof import('expo-audio');
let _cachedAudioModule: any = null;
let _hasAttemptedAudioLoad = false;

function getSafeAudioModule(): any {
  if (_hasAttemptedAudioLoad) return _cachedAudioModule;
  _hasAttemptedAudioLoad = true;

  try {
    const nativeExpoAudio = requireOptionalNativeModule('ExpoAudio');
    if (nativeExpoAudio) {
      const mod = require('expo-audio');
      _cachedAudioModule = mod?.default || mod;
      return _cachedAudioModule;
    }
  } catch (e) {
    console.warn('[voiceAiService] Native ExpoAudio check failed:', e);
  }

  try {
    const mod = require('expo-audio');
    _cachedAudioModule = mod?.default || mod;
    return _cachedAudioModule;
  } catch {
    _cachedAudioModule = null;
    return null;
  }
}

// ── Pure JavaScript Base64 encoder for Uint8Array (fast & rock-solid) ────────
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let base64 = '';
  const len = bytes.byteLength;
  const byteRemainder = len % 3;
  const mainLength = len - byteRemainder;

  let chunk: number;
  for (let i = 0; i < mainLength; i += 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    base64 +=
      B64_CHARS[(chunk & 16515072) >> 18] +
      B64_CHARS[(chunk & 258048) >> 12] +
      B64_CHARS[(chunk & 4032) >> 6] +
      B64_CHARS[chunk & 63];
  }

  if (byteRemainder === 1) {
    chunk = bytes[mainLength];
    base64 += B64_CHARS[(chunk & 252) >> 2] + B64_CHARS[(chunk & 3) << 4] + '==';
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    base64 +=
      B64_CHARS[(chunk & 64512) >> 10] +
      B64_CHARS[(chunk & 1008) >> 4] +
      B64_CHARS[(chunk & 15) << 2] +
      '=';
  }

  return base64;
}

/**
 * Converts binary audio Response (audio/mpeg) directly to base64.
 * Reads the response stream ONCE to prevent "body already read" stream errors.
 */
async function responseToBase64(resp: Response): Promise<string> {
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return uint8ArrayToBase64(bytes);
}

class VoiceAIService {
  private currentPlayer: any = null;
  private currentStatusSub: { remove: () => void } | null = null;
  private levelInterval: any = null;
  private isSpeaking: boolean = false;
  private currentTempAudioUri: string | null = null;

  /**
   * Generates conversational AI voice response.
   * Tries dedicated backend endpoint first, falls back to direct client LLM chain.
   */
  public async generateVoiceResponse(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<{ response: string; language: string }> {
    const baseUrl = resolveBackendBaseUrl();
    const endpoint = `${baseUrl}/api/mobile/voice-ai`;

    try {
      let token: string | undefined;
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => undefined);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          conversationHistory,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.response && data.response.trim()) {
          return {
            response: data.response.trim(),
            language: data.language || 'en',
          };
        }
      }
    } catch (_) {
      // Backend voice-ai endpoint unavailable, gracefully use LLM fallback
    }

    // Direct Client-Side Fallback via LLMFallbackService
    const context = conversationHistory.slice(-4).map((msg) =>
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n') + '\n\n';

    const prompt = `${context}User asks: "${query}"

Please provide a short, clear, and natural conversational voice response (2-3 sentences maximum).
- Sound like you are speaking naturally in real-time conversation
- Be concise, direct, and helpful
- Do not use markdown symbols, bullet points, citations, or formatting
- If the user spoke in Hindi or another language, respond in that same language

Response:`;

    const llmResp = await LLMFallbackService.routeRequest(
      'auto',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.7,
        max_tokens: 250,
      }
    );

    const rawReply = llmResp.choices?.[0]?.message?.content || '';
    let cleaned = rawReply
      .replace(/[#*_`\[\]()]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 500) {
      const sentences = cleaned.split(/[.!?]+/).filter((s: string) => Boolean(s.trim()));
      cleaned = sentences.slice(0, 2).join('. ').trim() + '.';
    }

    return {
      response: cleaned || 'I am here and ready to help. What would you like to explore?',
      language: 'en',
    };
  }

  /**
   * Synthesize audio from text using server-side ElevenLabs route.
   * Priority:
   *  1. Dedicated Mobile Backend (/api/tts -> https://api-mobile.chatboxai.co.in/api/tts) [PRIMARY]
   *  2. Dedicated Mobile Backend (/api/mobile/tts -> https://api-mobile.chatboxai.co.in/api/mobile/tts)
   *  3. Production Web API Fallback (/api/tts -> https://chatboxai.co.in/api/tts)
   * Returns temporary local MP3 file URI.
   */
  public async synthesizeSpeech(text: string, voiceOptionId: string): Promise<string> {
    const mobileBase = (
      process.env.EXPO_PUBLIC_MOBILE_API_URL ||
      resolveBackendBaseUrl() ||
      'https://api-mobile.chatboxai.co.in'
    ).trim().replace(/\/+$/, '');

    const webBase = (
      process.env.EXPO_PUBLIC_WEB_API_URL ||
      'https://chatboxai.co.in'
    ).trim().replace(/\/+$/, '');

    // Candidates in prioritized order:
    // 1. Primary: Dedicated Mobile Backend /api/tts (e.g. https://api-mobile.chatboxai.co.in/api/tts)
    // 2. Secondary: Dedicated Mobile Backend /api/mobile/tts (e.g. https://api-mobile.chatboxai.co.in/api/mobile/tts)
    // 3. Fallback: Web API /api/tts (e.g. https://chatboxai.co.in/api/tts)
    const candidates = [
      `${mobileBase}/api/tts`,
      `${mobileBase}/api/mobile/tts`,
      `${webBase}/api/tts`,
    ];
    const endpoints = Array.from(new Set(candidates));

    let token: string | undefined;
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken().catch(() => undefined);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg, audio/*, application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const payload = JSON.stringify({
      text,
      voiceOptionId,
      voiceId: voiceOptionId,
    });

    // Web platform: return object URL directly
    if (Platform.OS === 'web') {
      for (const endpoint of endpoints) {
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: payload,
          });
          if (resp.ok) {
            const blob = await resp.blob();
            return URL.createObjectURL(blob);
          }
        } catch (_) {}
      }
      throw new Error('TTS synthesis failed on web');
    }

    // Native platforms: fetch binary, convert to base64, and write to cache
    let base64Data: string | null = null;
    let lastError: any = null;

    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: payload,
        });

        if (!resp.ok) {
          lastError = new Error(`TTS HTTP ${resp.status} from ${endpoint}`);
          continue;
        }

        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = await resp.json().catch(() => ({}));
          lastError = new Error(json.error || `TTS returned error JSON from ${endpoint}`);
          continue;
        }

        base64Data = await responseToBase64(resp);
        if (base64Data && base64Data.length > 0) {
          break; // Successfully downloaded and converted audio!
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!base64Data) {
      throw lastError || new Error('TTS synthesis failed across all endpoints');
    }

    const tempFileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.mp3`;

    await FileSystem.writeAsStringAsync(tempFileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    this.currentTempAudioUri = tempFileUri;
    return tempFileUri;
  }

  /**
   * Play synthesized speech with real-time level reporting and completion promise.
   */
  public async playSpeech(
    audioUri: string,
    fallbackText: string,
    onLevelUpdate: (level: number) => void
  ): Promise<void> {
    // Stop any previous playback without deleting the new audioUri
    this.stopPlaybackInternal(false);
    this.currentTempAudioUri = audioUri;
    this.isSpeaking = true;

    return new Promise<void>(async (resolve) => {
      let resolved = false;
      let safetyTimeout: any = null;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          if (safetyTimeout) clearTimeout(safetyTimeout);
          this.stopPlaybackInternal(true);
          onLevelUpdate(0);
          resolve();
        }
      };

      const audioModule = getSafeAudioModule();

      // Attempt 1: High-fidelity ElevenLabs playback via expo-audio
      if (audioModule && audioUri) {
        try {
          const setMode =
            audioModule.setAudioModeAsync ||
            audioModule?.default?.setAudioModeAsync;
          if (typeof setMode === 'function') {
            await setMode({
              playsInSilentMode: true,
              allowsRecording: false,
            }).catch(() => {});
          }

          const createPlayer =
            audioModule.createAudioPlayer ||
            audioModule?.default?.createAudioPlayer;

          if (typeof createPlayer !== 'function') {
            throw new Error('createAudioPlayer is not a function');
          }

          const player = createPlayer(audioUri);
          this.currentPlayer = player;

          // Start simulating organic voice wave levels during speech
          this.startLevelSimulation(onLevelUpdate);

          const sub = (player as any).addListener('playbackStatusUpdate', (status: any) => {
            if (
              status?.didJustFinish ||
              (!status?.playing && status?.currentTime > 0 && status?.currentTime >= (status?.duration || 0) - 0.25) ||
              status?.error
            ) {
              finish();
            }
          });
          this.currentStatusSub = sub;

          // Safety timeout in case duration is known or general fallback
          safetyTimeout = setTimeout(finish, 20000);

          player.play();
          return;
        } catch (playerErr) {
          console.warn('[voiceAiService] expo-audio player failed, falling back to expo-speech:', playerErr);
        }
      }

      // Attempt 2: Native device TTS fallback via expo-speech
      try {
        const cleaned = preprocessTextForTTS(fallbackText, 400);
        this.startLevelSimulation(onLevelUpdate);
        Speech.speak(cleaned, {
          language: 'en-US',
          pitch: 1.0,
          rate: 1.0,
          onDone: finish,
          onStopped: finish,
          onError: finish,
        });
      } catch (speechErr) {
        console.warn('[voiceAiService] Speech.speak failed:', speechErr);
        finish();
      }
    });
  }

  /**
   * Stop active audio playback immediately (interruption or end call).
   */
  public stopPlayback() {
    this.stopPlaybackInternal(true);
  }

  /**
   * Internal player teardown with optional audio file cleanup.
   */
  private stopPlaybackInternal(cleanupFile: boolean = true) {
    this.isSpeaking = false;

    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }

    if (this.currentStatusSub) {
      try {
        this.currentStatusSub.remove();
      } catch (_) {}
      this.currentStatusSub = null;
    }

    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause?.();
        this.currentPlayer.release?.();
      } catch (_) {}
      this.currentPlayer = null;
    }

    try {
      Speech.stop();
    } catch (_) {}

    // Clean up temporary audio file if requested
    if (cleanupFile && this.currentTempAudioUri) {
      const fileToDelete = this.currentTempAudioUri;
      this.currentTempAudioUri = null;
      FileSystem.deleteAsync(fileToDelete, { idempotent: true }).catch(() => {});
    }
  }

  /**
   * Simulates realistic voice frequency dynamics (0.2 to 0.95) to feed the Orb's speaking state.
   */
  private startLevelSimulation(onLevelUpdate: (level: number) => void) {
    if (this.levelInterval) clearInterval(this.levelInterval);

    this.levelInterval = setInterval(() => {
      if (!this.isSpeaking) {
        clearInterval(this.levelInterval);
        this.levelInterval = null;
        onLevelUpdate(0);
        return;
      }

      // Voice rhythm cadence: random undulating wave simulating speech cadence
      const base = 0.35 + Math.random() * 0.5;
      const pauseProbability = Math.random();
      const level = pauseProbability < 0.12 ? 0.15 : base;
      onLevelUpdate(level);
    }, 100);
  }
}

export const voiceAiService = new VoiceAIService();
