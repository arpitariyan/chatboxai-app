/**
 * ChatBox AI Mobile Design System - Motion System
 * SOURCE OF TRUTH: src/styles/global.css
 */

import { MOTION_TOKENS } from './tokens';
import { ThemeMotion } from './types';

export const motion: ThemeMotion = MOTION_TOKENS;

/**
 * Spring configurations for Reanimated / Animated
 */
export const springConfigs = {
  snappy: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
  gentle: {
    damping: 28,
    stiffness: 180,
    mass: 1,
  },
  bouncy: {
    damping: 15,
    stiffness: 220,
    mass: 0.9,
  },
};

/**
 * Returns whether reduced motion is requested, collapsing durations to 0
 */
export function getMotionDuration(baseDuration: number, isReducedMotion = false): number {
  return isReducedMotion ? 0 : baseDuration;
}
