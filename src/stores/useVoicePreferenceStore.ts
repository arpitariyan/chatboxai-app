/**
 * src/stores/useVoicePreferenceStore.ts
 *
 * Persisted assistant voice preference store.
 * Synchronizes with AsyncStorage ('chatbox_assistant_voice_id') to persist the
 * selected assistant voice identity across sessions and reloads.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ASSISTANT_VOICES,
  DEFAULT_ASSISTANT_VOICE_ID,
  AssistantVoice,
  getVoiceOptionById,
} from '../services/voice/voiceRegistry';

const VOICE_PREF_KEY = 'chatbox_assistant_voice_id';

interface VoicePreferenceState {
  selectedVoiceId: string;
  isLoaded: boolean;
  setSelectedVoiceId: (id: string) => Promise<void>;
  getSelectedVoice: () => AssistantVoice;
  loadPreference: () => Promise<void>;
}

export const useVoicePreferenceStore = create<VoicePreferenceState>((set, get) => ({
  selectedVoiceId: DEFAULT_ASSISTANT_VOICE_ID,
  isLoaded: false,

  setSelectedVoiceId: async (id: string) => {
    const approved = getVoiceOptionById(id);
    set({ selectedVoiceId: approved.id });
    try {
      await AsyncStorage.setItem(VOICE_PREF_KEY, approved.id);
    } catch (err) {
      console.warn('[useVoicePreferenceStore] Failed to save voice preference:', err);
    }
  },

  getSelectedVoice: () => {
    return getVoiceOptionById(get().selectedVoiceId);
  },

  loadPreference: async () => {
    try {
      const stored = await AsyncStorage.getItem(VOICE_PREF_KEY);
      if (stored) {
        const approved = getVoiceOptionById(stored);
        set({ selectedVoiceId: approved.id, isLoaded: true });
        return;
      }
    } catch (err) {
      console.warn('[useVoicePreferenceStore] Failed to load voice preference:', err);
    }
    set({ selectedVoiceId: DEFAULT_ASSISTANT_VOICE_ID, isLoaded: true });
  },
}));

// Eagerly initiate loading on module load
useVoicePreferenceStore.getState().loadPreference();
