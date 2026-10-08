/**
 * ChatBox AI Mobile Design System - Color Utilities & Hooks
 * SOURCE OF TRUTH: src/styles/global.css
 */

import { useColorScheme } from 'react-native';
import { RAW_LIGHT_TOKENS, RAW_DARK_TOKENS, ACCENT_TOKENS } from './tokens';
import { AccentColor, ColorScheme, ThemeColors } from './types';
import { usePreferencesStore } from '../stores/usePreferencesStore';

/**
 * Resolve full theme colors given a scheme ('light' | 'dark') and an optional accent color.
 * Defaults to 'dark' mode.
 */
export function getColors(scheme: ColorScheme = 'dark', accent?: AccentColor): ThemeColors {
  const isDark = scheme === 'dark';
  const base: ThemeColors = isDark ? { ...RAW_DARK_TOKENS } : { ...RAW_LIGHT_TOKENS };
  base.isDark = isDark;

  if (accent && ACCENT_TOKENS[accent]) {
    const accentToken = ACCENT_TOKENS[accent][scheme];
    base.primary = accentToken.primary;
    base.ring = accentToken.ring;
    base.accent = accentToken.primary;
  }

  return base;
}

/**
 * React hook to access resolved theme colors according to the active color scheme.
 * Resolves dynamically from usePreferencesStore (themeMode and accentColor) and system settings.
 * DEFAULTS TO DARK MODE for a premium AI product experience.
 */
export function useThemeColors(forcedAccent?: AccentColor, forcedScheme?: ColorScheme): ThemeColors {
  const systemScheme = useColorScheme();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const preferredAccent = usePreferencesStore((s) => s.accentColor);

  let scheme: ColorScheme = 'dark';
  if (forcedScheme) {
    scheme = forcedScheme;
  } else if (themeMode === 'system') {
    scheme = systemScheme === 'light' ? 'light' : 'dark';
  } else {
    scheme = themeMode === 'light' ? 'light' : 'dark';
  }

  const accent = forcedAccent || preferredAccent;
  return getColors(scheme, accent);
}

/**
 * Static tokens for light mode.
 */
export const lightColors: ThemeColors = getColors('light');

/**
 * Static tokens for dark mode.
 */
export const darkColors: ThemeColors = getColors('dark');
