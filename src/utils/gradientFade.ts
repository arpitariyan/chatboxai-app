/**
 * ChatBox AI - Gradient Fade Utility
 *
 * Generates smooth multi-stop color and location configurations for linear gradients
 * to create seamless, cinema-grade fade transitions at scroll boundaries (top & bottom of conversation).
 *
 * Uses a smooth non-linear ease curve so text dissolves softly without harsh color banding
 * or leaving half-visible letter fragments near the boundary.
 */

export type GradientTuple<T> = readonly [T, T, ...T[]];

export interface FadeGradientConfig {
  colors: readonly [string, string, string, string, string, string];
  locations: readonly [number, number, number, number, number, number];
}

export function getFadeGradientConfig(
  bgColor: string,
  direction: 'toTransparent' | 'fromTransparent'
): FadeGradientConfig {
  let r = 24, g = 24, b = 27; // Default rich neutral dark #18181b
  if (bgColor && bgColor.startsWith('#')) {
    const hex = bgColor.replace('#', '');
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    }
  }

  // Smooth quadratic ease curve:
  // Starts with zero opacity, builds gently, and hits full 1.0 opacity well before the edge
  // so no partial letters can ever peek through at the boundary.
  const a0 = 0;
  const a1 = 0.12;
  const a2 = 0.40;
  const a3 = 0.75;
  const a4 = 0.95;
  const a5 = 1.0;

  if (direction === 'fromTransparent') {
    // Bottom fade: transparent at top, smoothly blends to 100% solid background at bottom
    return {
      colors: [
        `rgba(${r}, ${g}, ${b}, ${a0})`,
        `rgba(${r}, ${g}, ${b}, ${a1})`,
        `rgba(${r}, ${g}, ${b}, ${a2})`,
        `rgba(${r}, ${g}, ${b}, ${a3})`,
        `rgba(${r}, ${g}, ${b}, ${a4})`,
        `rgba(${r}, ${g}, ${b}, ${a5})`,
      ],
      locations: [0, 0.18, 0.38, 0.62, 0.84, 1.0],
    };
  } else {
    // Top fade: 100% solid background at header, smoothly becomes transparent into messages
    return {
      colors: [
        `rgba(${r}, ${g}, ${b}, ${a5})`,
        `rgba(${r}, ${g}, ${b}, ${a4})`,
        `rgba(${r}, ${g}, ${b}, ${a3})`,
        `rgba(${r}, ${g}, ${b}, ${a2})`,
        `rgba(${r}, ${g}, ${b}, ${a1})`,
        `rgba(${r}, ${g}, ${b}, ${a0})`,
      ],
      locations: [0, 0.16, 0.38, 0.62, 0.82, 1.0],
    };
  }
}
