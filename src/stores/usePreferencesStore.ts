/**
 * src/stores/usePreferencesStore.ts
 *
 * Centralized, persisted user and device preferences store for ChatBox AI APK.
 * Source of truth for Theme Mode, Accent Color, Language, Chat Font, Voice Orb Color,
 * Experience controls (compact mode, reduced motion, sound effects), and Memory toggle.
 *
 * Persisted in AsyncStorage under '@chatboxai:user_preferences'.
 * Synchronizes with Appwrite UserProfile when logged in.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentColor, ChatFont } from '../theme/types';
import { updateUserProfile } from '../services/userService';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';

const PREFS_STORAGE_KEY = '@chatboxai:user_preferences';

export type ThemeMode = 'dark' | 'light' | 'system';
import type { AppLanguage } from '../i18n/types';
export type { AppLanguage };
export type OrbColorId = 'cyan' | 'purple' | 'blue' | 'rose' | 'amber';

export interface OrbColorPreset {
  id: OrbColorId;
  name: string;
  from: string;
  to: string;
  hex: string;
}

export const ORB_COLOR_PRESETS: Record<OrbColorId, OrbColorPreset> = {
  cyan: { id: 'cyan', name: 'Cyan (Default)', from: '#00E6C3', to: '#66FFE5', hex: '#00E6C3' },
  purple: { id: 'purple', name: 'Purple', from: '#9333EA', to: '#C084FC', hex: '#9333EA' },
  blue: { id: 'blue', name: 'Blue', from: '#2563EB', to: '#60A5FA', hex: '#2563EB' },
  rose: { id: 'rose', name: 'Rose', from: '#E11D48', to: '#FB7185', hex: '#E11D48' },
  amber: { id: 'amber', name: 'Amber', from: '#D97706', to: '#FBBF24', hex: '#D97706' },
};

export const ACCENT_COLOR_OPTIONS: { name: string; value: AccentColor; hex: string }[] = [
  { name: 'Violet', value: 'violet', hex: '#8b5cf6' },
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Emerald', value: 'emerald', hex: '#10b981' },
  { name: 'Amber', value: 'amber', hex: '#f59e0b' },
  { name: 'Rose', value: 'rose', hex: '#f43f5e' },
  { name: 'Indigo', value: 'indigo', hex: '#6366f1' },
];

export const CHAT_FONT_OPTIONS: { label: string; value: ChatFont }[] = [
  { label: 'Default', value: 'default' },
  { label: 'Sans', value: 'sans' },
  { label: 'System', value: 'system' },
  { label: 'Dyslexic', value: 'dyslexic' },
  { label: 'Oswald', value: 'oswald' },
  { label: 'Boldonse', value: 'boldonse' },
  { label: 'Libre Baskerville', value: 'libre-baskerville' },
  { label: 'Unbounded', value: 'unbounded' },
  { label: 'Berkshire Swash', value: 'berkshire-swash' },
];

export interface PreferencesState {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  language: AppLanguage;
  chatFont: ChatFont;
  orbColor: OrbColorId;
  compactMode: boolean;
  reducedMotion: boolean;
  soundEffects: boolean;
  memoryEnabled: boolean;
  isLoaded: boolean;

  // Actions
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAccentColor: (color: AccentColor, userDocId?: string) => Promise<void>;
  setLanguage: (lang: AppLanguage, userDocId?: string) => Promise<void>;
  setChatFont: (font: ChatFont, userDocId?: string) => Promise<void>;
  setOrbColor: (color: OrbColorId) => Promise<void>;
  setCompactMode: (enabled: boolean) => Promise<void>;
  setReducedMotion: (enabled: boolean) => Promise<void>;
  setSoundEffects: (enabled: boolean) => Promise<void>;
  setMemoryEnabled: (enabled: boolean, userDocId?: string) => Promise<void>;
  resetDefaults: (userDocId?: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
  syncFromUserProfile: (profile: {
    accent_color?: string;
    language?: string;
    chat_font?: string;
    memory_enabled?: boolean;
  }) => void;
}

const DEFAULT_STATE = {
  themeMode: 'system' as ThemeMode,
  accentColor: 'violet' as AccentColor,
  language: 'en' as AppLanguage,
  chatFont: 'default' as ChatFont,
  orbColor: 'cyan' as OrbColorId,
  compactMode: false,
  reducedMotion: false,
  soundEffects: true,
  memoryEnabled: true,
};

async function persistToStorage(data: Partial<typeof DEFAULT_STATE>) {
  try {
    const raw = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    const merged = { ...existing, ...data };
    await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('[usePreferencesStore] Failed to persist preferences:', err);
  }
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...DEFAULT_STATE,
  isLoaded: false,

  setThemeMode: async (mode: ThemeMode) => {
    set({ themeMode: mode });
    await persistToStorage({ themeMode: mode });
  },

  setAccentColor: async (color: AccentColor, userDocId?: string) => {
    set({ accentColor: color });
    await persistToStorage({ accentColor: color });
    if (userDocId) {
      updateUserProfile(userDocId, { accent_color: color }).catch(() => {});
    }
  },

  setLanguage: async (lang: AppLanguage, userDocId?: string) => {
    set({ language: lang });
    await persistToStorage({ language: lang });
    if (userDocId) {
      updateUserProfile(userDocId, { language: lang }).catch(() => {});
    }
  },

  setChatFont: async (font: ChatFont, userDocId?: string) => {
    set({ chatFont: font });
    await persistToStorage({ chatFont: font });
    if (userDocId) {
      updateUserProfile(userDocId, { chat_font: font }).catch(() => {});
    }
  },

  setOrbColor: async (color: OrbColorId) => {
    set({ orbColor: color });
    await persistToStorage({ orbColor: color });
  },

  setCompactMode: async (enabled: boolean) => {
    set({ compactMode: enabled });
    await persistToStorage({ compactMode: enabled });
  },

  setReducedMotion: async (enabled: boolean) => {
    set({ reducedMotion: enabled });
    await persistToStorage({ reducedMotion: enabled });
  },

  setSoundEffects: async (enabled: boolean) => {
    set({ soundEffects: enabled });
    await persistToStorage({ soundEffects: enabled });
  },

  setMemoryEnabled: async (enabled: boolean, userDocId?: string) => {
    set({ memoryEnabled: enabled });
    await persistToStorage({ memoryEnabled: enabled });
    if (userDocId) {
      updateUserProfile(userDocId, { memory_enabled: enabled }).catch(() => {});
    }
  },

  resetDefaults: async (userDocId?: string) => {
    set({ ...DEFAULT_STATE });
    try {
      await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
    } catch (err) {
      console.warn('[usePreferencesStore] Failed to reset preferences:', err);
    }
    if (userDocId) {
      updateUserProfile(userDocId, {
        accent_color: 'violet',
        language: 'en',
        chat_font: 'default',
        memory_enabled: true,
      }).catch(() => {});
    }
  },

  loadPreferences: async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          themeMode: parsed.themeMode || DEFAULT_STATE.themeMode,
          accentColor: parsed.accentColor || DEFAULT_STATE.accentColor,
          language: parsed.language || DEFAULT_STATE.language,
          chatFont: parsed.chatFont || DEFAULT_STATE.chatFont,
          orbColor: parsed.orbColor || DEFAULT_STATE.orbColor,
          compactMode: typeof parsed.compactMode === 'boolean' ? parsed.compactMode : DEFAULT_STATE.compactMode,
          reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULT_STATE.reducedMotion,
          soundEffects: typeof parsed.soundEffects === 'boolean' ? parsed.soundEffects : DEFAULT_STATE.soundEffects,
          memoryEnabled: typeof parsed.memoryEnabled === 'boolean' ? parsed.memoryEnabled : DEFAULT_STATE.memoryEnabled,
          isLoaded: true,
        });
        return;
      }
    } catch (err) {
      console.warn('[usePreferencesStore] Failed to load preferences:', err);
    }
    set({ isLoaded: true });
  },

  syncFromUserProfile: (profile) => {
    const updates: Partial<typeof DEFAULT_STATE> = {};
    if (profile.accent_color && ACCENT_COLOR_OPTIONS.some((a) => a.value === profile.accent_color)) {
      updates.accentColor = profile.accent_color as AccentColor;
    }
    if (profile.language && SUPPORTED_LANGUAGES.some((l) => l.code === profile.language)) {
      updates.language = profile.language as AppLanguage;
    }
    if (profile.chat_font && CHAT_FONT_OPTIONS.some((f) => f.value === profile.chat_font)) {
      updates.chatFont = profile.chat_font as ChatFont;
    }
    if (typeof profile.memory_enabled === 'boolean') {
      updates.memoryEnabled = profile.memory_enabled;
    }
    if (Object.keys(updates).length > 0) {
      set((prev) => ({ ...prev, ...updates }));
      persistToStorage(updates);
    }
  },
}));

// Eager load preferences
usePreferencesStore.getState().loadPreferences();
