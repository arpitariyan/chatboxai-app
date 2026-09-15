/**
 * ChatBox AI Mobile Design System - Central Entry Point
 * SOURCE OF TRUTH: src/styles/global.css
 */

export * from './types';
export * from './tokens';
export * from './colors';
export * from './spacing';
export * from './radius';
export * from './typography';
export * from './motion';

import { getColors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';
import { motion } from './motion';
import { AccentColor, ColorScheme, Theme } from './types';

/**
 * Construct a unified Theme object
 */
export function createTheme(
  scheme: ColorScheme = 'light',
  accent?: AccentColor,
  chatFont: import('./types').ChatFont = 'default'
): Theme {
  return {
    colors: getColors(scheme, accent),
    spacing,
    radius,
    typography,
    motion,
    isDark: scheme === 'dark',
    accent: accent || 'violet',
    chatFont,
  };
}
