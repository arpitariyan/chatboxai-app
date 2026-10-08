/**
 * src/i18n/types.ts
 *
 * Types and interfaces for the ChatBox AI Mobile i18n system.
 * Supports ISO-standard language definitions and complete UI translations.
 */

export type AppLanguage =
  | 'en'
  | 'hi'
  | 'es'
  | 'fr'
  | 'de'
  | 'ja'
  | 'zh'
  | 'ar'
  | 'pt'
  | 'ru'
  | 'it'
  | 'ko';

export interface LanguageOption {
  code: AppLanguage;
  iso: string;
  name: string;
  nativeName: string;
  region: string;
}

export interface TranslationDictionary {
  // Navigation & Common
  home: string;
  settings: string;
  newChat: string;
  history: string;
  images: string;
  imageGen: string;
  library: string;
  incognito: string;
  incognitoOn: string;
  back: string;
  cancel: string;
  done: string;
  close: string;
  save: string;
  delete: string;
  copied: string;
  restoreDefaults: string;
  change: string;
  search: string;
  explore: string;
  pinned: string;
  recents: string;
  noConversations: string;

  // Composer & Chat
  askAnything: string;
  searchWeb: string;
  deepResearch: string;
  listening: string;
  thinking: string;
  speaking: string;
  send: string;
  stop: string;
  tapToSpeak: string;
  dictate: string;
  openVoiceCall: string;

  // Settings Tabs
  tabGeneral: string;
  tabAccount: string;
  tabSecurity: string;
  tabMemory: string;
  tabApiKeys: string;
  tabHelp: string;

  // General Settings Section
  appearanceTheme: string;
  theme: string;
  themeDesc: string;
  dark: string;
  light: string;
  system: string;
  accentColor: string;
  accentColorDesc: string;
  language: string;
  languageDesc: string;
  chatFont: string;
  chatFontDesc: string;
  assistantVoice: string;
  assistantVoiceDesc: string;
  voiceOrbGradient: string;
  voiceOrbDesc: string;
  experiencePerf: string;
  compactLayout: string;
  compactLayoutDesc: string;
  reducedMotion: string;
  reducedMotionDesc: string;
  soundEffects: string;
  soundEffectsDesc: string;
  restoreDefaultSettings: string;
  searchLanguages: string;

  // Model Selection
  selectAiModel: string;
  selectImageModel: string;
  searchModels: string;
  searchImageModels: string;
  noModelsMatch: string;

  // Voice AI
  tapMicToStart: string;
  tapMicToTalk: string;
  kuchSunaNahi: string;
  micMuted: string;
  somethingWentWrong: string;
  sessionPausedBg: string;
}
