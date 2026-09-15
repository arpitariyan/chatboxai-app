/**
 * ChatBox AI Mobile Design System - Color Utilities & Hooks
 * SOURCE OF TRUTH: src/styles/global.css
 */

import { useColorScheme } from 'react-native';
import { RAW_LIGHT_TOKENS, RAW_DARK_TOKENS, ACCENT_TOKENS } from './tokens';
import { AccentColor, ColorScheme, ThemeColors } from './types';

/**
 * Resolve full theme colors given a scheme ('light' | 'dark') and an optional accent color.
 * Defaults to 'dark' mode.
 */
export function getColors(scheme: ColorScheme = 'dark', accent?: AccentColor): ThemeColors {
  const isDark = scheme === 'dark';
  const base: ThemeColors = isDark ? { ...RAW_DARK_TOKENS } : { ...RAW_LIGHT_TOKENS };

  if (accent && ACCENT_TOKENS[accent]) {
    const accentToken = ACCENT_TOKENS[accent][scheme];
    base.primary = accentToken.primary;
    base.ring = accentToken.ring;
  }

  return base;
}

/**
 * React hook to access resolved theme colors according to the active color scheme.
 * DEFAULTS TO DARK MODE ALWAYS for a premium AI product experience.
 */
export function useThemeColors(accent?: AccentColor, forcedScheme?: ColorScheme): ThemeColors {
  const scheme: ColorScheme = forcedScheme || 'dark';
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
