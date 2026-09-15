/**
 * ChatBox AI Mobile Design System - Typography
 * SOURCE OF TRUTH: src/styles/global.css
 */

import { FONT_TOKENS } from './tokens';
import { ChatFont, ThemeTypography } from './types';

export const typography: ThemeTypography = {
  fontFamily: FONT_TOKENS,
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    landingHeadingLg: 32,
    landingHeadingXl: 48,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.6,
  },
};

/**
 * Helper to resolve the active font family for chat messages
 */
export function getChatFontFamily(font: ChatFont = 'default'): string {
  return FONT_TOKENS.chatFonts[font] || FONT_TOKENS.chatFonts.default;
}

/**
 * Tabular numerals style helper for numbers, timers, metrics
 */
export const tabularNums = {
  fontVariant: ['tabular-nums'] as const,
};
