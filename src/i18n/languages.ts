/**
 * src/i18n/languages.ts
 *
 * Dedicated language metadata catalog.
 * Isolated from store and translation dictionaries to eliminate circular dependencies.
 */

import { LanguageOption } from './types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', iso: 'EN', name: 'English (US)', nativeName: 'English', region: 'Global' },
  { code: 'hi', iso: 'HI', name: 'Hindi', nativeName: 'हिन्दी', region: 'India' },
  { code: 'es', iso: 'ES', name: 'Spanish', nativeName: 'Español', region: 'Spain & LatAm' },
  { code: 'fr', iso: 'FR', name: 'French', nativeName: 'Français', region: 'France' },
  { code: 'de', iso: 'DE', name: 'German', nativeName: 'Deutsch', region: 'Germany' },
  { code: 'ja', iso: 'JA', name: 'Japanese', nativeName: '日本語', region: 'Japan' },
  { code: 'zh', iso: 'ZH', name: 'Chinese', nativeName: '简体中文', region: 'China' },
  { code: 'ar', iso: 'AR', name: 'Arabic', nativeName: 'العربية', region: 'Middle East' },
  { code: 'pt', iso: 'PT', name: 'Portuguese', nativeName: 'Português', region: 'Brazil & Portugal' },
  { code: 'ru', iso: 'RU', name: 'Russian', nativeName: 'Русский', region: 'Eastern Europe' },
  { code: 'it', iso: 'IT', name: 'Italian', nativeName: 'Italiano', region: 'Italy' },
  { code: 'ko', iso: 'KO', name: 'Korean', nativeName: '한국어', region: 'South Korea' },
];
