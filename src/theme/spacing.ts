/**
 * ChatBox AI Mobile Design System - Spacing Scale
 * SOURCE OF TRUTH: src/styles/global.css
 */

import { SPACING_TOKENS } from './tokens';
import { ThemeSpacing } from './types';

export const spacing: ThemeSpacing = SPACING_TOKENS;

/**
 * Compact mode spacing multipliers (from html.compact-mode in global.css)
 */
export const compactSpacing = {
  buttonMinHeight: 32, // 2rem
  buttonPaddingHorizontal: 10, // 0.6rem
  buttonPaddingVertical: 4, // 0.25rem
  inputHeight: 32, // 2rem
  inputPaddingHorizontal: 9, // 0.55rem
  tabsListMinHeight: 32, // 2rem
  tabsTriggerMinHeight: 26, // 1.65rem
  p6: 18, // 1.15rem
  p4: 13, // 0.8rem
};
