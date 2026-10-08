/**
 * src/i18n/index.ts
 *
 * Primary entry point for internationalization (i18n).
 * Exports the reactive useTranslation hook, fallback t function,
 * and supported languages list.
 */

import { useMemo } from 'react';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { TRANSLATIONS, SUPPORTED_LANGUAGES } from './translations';
import { AppLanguage, LanguageOption, TranslationDictionary } from './types';

export * from './types';
export { SUPPORTED_LANGUAGES };

/**
 * Reactive hook that returns the active translation dictionary and helper.
 * Automatically re-renders components whenever user switches language in settings.
 */
export function useTranslation() {
  const language = usePreferencesStore((s) => s.language) as AppLanguage;

  const currentDict = useMemo(() => {
    return TRANSLATIONS[language] || TRANSLATIONS.en;
  }, [language]);

  const t = useMemo(() => {
    return (key: keyof TranslationDictionary, fallback?: string): string => {
      const val = currentDict[key] || TRANSLATIONS.en[key];
      return val !== undefined ? val : (fallback || String(key));
    };
  }, [currentDict]);

  const activeLanguageInfo = useMemo((): LanguageOption => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  return {
    t,
    language,
    currentDict,
    activeLanguageInfo,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}

/**
 * Static translation helper for non-React contexts or fast lookups.
 */
export function getTranslation(key: keyof TranslationDictionary, lang?: AppLanguage): string {
  const currentLang = lang || (usePreferencesStore.getState().language as AppLanguage) || 'en';
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || String(key);
}
