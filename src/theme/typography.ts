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

import { Platform } from 'react-native';

/**
 * Helper to resolve the active font family for chat messages across Android and iOS
 */
export function getChatFontFamily(font: ChatFont = 'default'): string {
  switch (font) {
    case 'sans':
      return Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif';
    case 'system':
      return Platform.OS === 'ios' ? 'System' : 'Roboto';
    case 'dyslexic':
      return Platform.OS === 'ios' ? 'Arial' : 'sans-serif';
    case 'oswald':
      return Platform.OS === 'ios' ? 'AvenirNextCondensed-Medium' : 'sans-serif-condensed';
    case 'boldonse':
      return Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-medium';
    case 'libre-baskerville':
      return Platform.OS === 'ios' ? 'Georgia' : 'serif';
    case 'unbounded':
      return Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-medium';
    case 'berkshire-swash':
      return Platform.OS === 'ios' ? 'Snell Roundhand' : 'serif';
    case 'default':
    default:
      return Platform.OS === 'ios' ? 'System' : 'sans-serif';
  }
}

/**
 * Tabular numerals style helper for numbers, timers, metrics
 */
export const tabularNums = {
  fontVariant: ['tabular-nums'] as const,
};
