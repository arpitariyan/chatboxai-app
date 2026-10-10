/**
 * src/hooks/useSpeechToText.ts
 *
 * React Native / Expo speech-to-text hook.
 * Records audio via expo-audio with real-time metering,
 * transcribes via Groq Whisper API (whisper-large-v3-turbo).
 *
 * Uses defensive module loading with requireOptionalNativeModule to ensure
 * the app never crashes even if run in an environment without the native audio module.
 */

import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo';

// ── Safe dynamic loader for expo-audio ───────────────────────────────────────
type ExpoAudioModuleType = typeof import('expo-audio');

let _cachedAudioModule: ExpoAudioModuleType | null = null;
let _hasAttemptedAudioLoad = false;

function getSafeAudioModule(): ExpoAudioModuleType | null {
  if (_hasAttemptedAudioLoad) return _cachedAudioModule;
  _hasAttemptedAudioLoad = true;

  try {
    _cachedAudioModule = require('expo-audio');
    return _cachedAudioModule;
  } catch (e) {
    try {
      const nativeExpoAudio = requireOptionalNativeModule('ExpoAudio');
      if (nativeExpoAudio) {
        _cachedAudioModule = require('expo-audio');
        return _cachedAudioModule;
      }
    } catch {
      // ignore
    }
    console.warn('[useSpeechToText] Native ExpoAudio module load failed:', e);
    _cachedAudioModule = null;
    return null;
  }
}

import { getEncryptedVaultKeys } from '@/services/security/encryptedKeyVault';

// ── Groq API key rotation with reliable production fallbacks ─────────────────
const ENV_GROQ_KEYS = [
  process.env.EXPO_PUBLIC_GROQ_API_KEY,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_2,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_3,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_4,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_5,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_6,
  process.env.EXPO_PUBLIC_GROQ_API_KEY_7,
].filter(Boolean) as string[];

const GROQ_KEYS = ENV_GROQ_KEYS.length > 0 ? ENV_GROQ_KEYS : getEncryptedVaultKeys('groq');

let _groqKeyIndex = 0;
const getNextGroqKey = (): string => {
  if (GROQ_KEYS.length === 0) return '';
  const key = GROQ_KEYS[_groqKeyIndex % GROQ_KEYS.length];
  _groqKeyIndex++;
  return key;
};

// ── Types ────────────────────────────────────────────────────────────────────
export type STTError =
  | 'PERMISSION_DENIED'
  | 'MODULE_UNAVAILABLE'
  | 'RECORD_FAILED'
  | 'TRANSCRIPTION_FAILED'
  | 'NO_SPEECH';

export interface UseSpeechToTextOptions {
  /** Receives the final transcript text on success. */
  onTranscript: (text: string) => void;
  /** Optional error callback. */
  onError?: (error: STTError, message: string) => void;
}

export interface UseSpeechToTextReturn {
  isListening: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => Promise<void>;
  toggleListening: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useSpeechToText({
  onTranscript,
  onError,
}: UseSpeechToTextOptions): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0.4);

  const recorderRef = useRef<any>(null);
  const statusSubRef = useRef<{ remove: () => void } | null>(null);

  // Transcribe local audio file via Groq Whisper API
  const transcribeAudio = async (uri: string): Promise<string> => {
    const apiKey = getNextGroqKey();
    if (!apiKey) {
      throw new Error('No Groq API key configured for speech transcription.');
    }

    // On native iOS/Android, use FileSystem.uploadAsync for binary file transmission
    if (Platform.OS !== 'web' && FileSystem?.uploadAsync) {
      const uploadResult = await FileSystem.uploadAsync(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        uri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          parameters: {
            model: 'whisper-large-v3-turbo',
            response_format: 'json',
          },
        }
      );

      if (uploadResult.status !== 200) {
        throw new Error(
          `Groq Whisper error ${uploadResult.status}: ${uploadResult.body}`
        );
      }

      const json = JSON.parse(uploadResult.body);
      return (json.text ?? '').trim();
    }

    // Web fallback using standard FormData
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'speech.m4a',
      type: 'audio/m4a',
    } as unknown as Blob);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    const response = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq Whisper error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    return (json.text ?? '').trim();
  };

  // Start recording
  const startListening = useCallback(async () => {
    if (isListening || isTranscribing) return;

    const audio = getSafeAudioModule();
    if (!audio) {
      onError?.(
        'MODULE_UNAVAILABLE',
        'Audio recording native module is not linked in this app build. Please update or rebuild the APK with the newly added audio module.'
      );
      return;
    }

    // Request permissions
    try {
      const { status } = await audio.requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        onError?.(
          'PERMISSION_DENIED',
          'Microphone permission denied. Please allow microphone access in your device settings.'
        );
        return;
      }
    } catch (e) {
      console.warn('[useSpeechToText] Permission request error:', e);
      onError?.('PERMISSION_DENIED', 'Could not obtain microphone permission.');
      return;
    }

    try {
      // Configure audio session for recording
      await audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Create new AudioRecorder instance using high-quality preset
      const recorder = new audio.AudioModule.AudioRecorder(
        audio.RecordingPresets.HIGH_QUALITY
      );

      // Listen for recording status updates to drive audioLevel metering
      const sub = (recorder as any).addListener(
        'recordingStatusUpdate',
        (status: any) => {
          if (status?.isRecording && typeof status.metering === 'number') {
            // Metering is in dB from -160 to 0 (typically -60 silent to 0 loud)
            const normalized = Math.max(
              0.15,
              Math.min(1.0, (status.metering + 60) / 60)
            );
            setAudioLevel(normalized);
          }
        }
      );
      statusSubRef.current = sub;

      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderRef.current = recorder;
      setIsListening(true);
    } catch (e) {
      console.warn('[useSpeechToText] Failed to start recording:', e);
      onError?.(
        'RECORD_FAILED',
        'Could not start microphone recording. Please try again.'
      );
    }
  }, [isListening, isTranscribing, onError]);

  // Stop recording + transcribe
  const stopListening = useCallback(async () => {
    if (!isListening || !recorderRef.current) return;

    setIsListening(false);
    setIsTranscribing(true);

    try {
      const rec = recorderRef.current;
      recorderRef.current = null;

      if (statusSubRef.current) {
        statusSubRef.current.remove();
        statusSubRef.current = null;
      }

      await rec.stop();
      const uri = rec.uri;

      // Restore audio session
      const audio = getSafeAudioModule();
      if (audio) {
        await audio.setAudioModeAsync({ allowsRecording: false }).catch(() => { });
      }

      if (!uri) {
        onError?.('RECORD_FAILED', 'Recording produced no audio file.');
        setIsTranscribing(false);
        return;
      }

      const text = await transcribeAudio(uri);

      // Clean up temp audio file
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => { });

      if (!text) {
        onError?.('NO_SPEECH', 'No speech detected. Please try again.');
      } else {
        onTranscript(text);
      }
    } catch (e) {
      console.warn('[useSpeechToText] Transcription failed:', e);
      onError?.(
        'TRANSCRIPTION_FAILED',
        'Transcription failed. Please try again.'
      );
    } finally {
      setIsTranscribing(false);
      setAudioLevel(0.4);
    }
  }, [isListening, onTranscript, onError]);

  // Cancel / discard recording without transcribing
  const cancelListening = useCallback(async () => {
    if (!isListening && !isTranscribing) return;

    setIsListening(false);
    setIsTranscribing(false);
    setAudioLevel(0.4);

    try {
      if (statusSubRef.current) {
        statusSubRef.current.remove();
        statusSubRef.current = null;
      }

      if (recorderRef.current) {
        const rec = recorderRef.current;
        recorderRef.current = null;
        await rec.stop().catch(() => { });
        const uri = rec.uri;
        if (uri) {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => { });
        }
      }

      const audio = getSafeAudioModule();
      if (audio) {
        await audio.setAudioModeAsync({ allowsRecording: false }).catch(() => { });
      }
    } catch (e) {
      console.warn('[useSpeechToText] Cancel error:', e);
    }
  }, [isListening, isTranscribing]);

  // Convenience toggle
  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isTranscribing,
    audioLevel,
    startListening,
    stopListening,
    cancelListening,
    toggleListening,
  };
}

