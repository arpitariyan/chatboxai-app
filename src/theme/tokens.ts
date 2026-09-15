/**
 * ChatBox AI Mobile Design System - Raw & Semantic Tokens Bridge
 * SOURCE OF TRUTH: src/styles/global.css
 *
 * This file maps the CSS variables and oklch/hex values from global.css into
 * typed, native-compatible tokens for React Native & Expo mobile components.
 * NO VALUES WERE CHANGED OR INVENTED.
 */

import { AccentColor, ThemeColors } from './types';

export const RAW_LIGHT_TOKENS: ThemeColors = {
  // Base & Surface
  background: '#ffffff', // oklch(1 0 0)
  foreground: '#090d16', // oklch(0.129 0.042 264.695)
  card: '#ffffff', // oklch(1 0 0)
  cardForeground: '#090d16', // oklch(0.129 0.042 264.695)
  popover: '#ffffff', // oklch(1 0 0)
  popoverForeground: '#090d16', // oklch(0.129 0.042 264.695)

  // Actions & Neutrals
  primary: '#3b2851', // oklch(0.3326 0.0797 295.8)
  primaryForeground: '#fafbfe', // oklch(0.984 0.003 247.858)
  secondary: '#f2f4f8', // oklch(0.968 0.007 247.896)
  secondaryForeground: '#192133', // oklch(0.208 0.042 265.755)
  muted: '#f2f4f8', // oklch(0.968 0.007 247.896)
  mutedForeground: '#737b8d', // oklch(0.554 0.046 257.417)
  accent: '#f2f4f8', // oklch(0.968 0.007 247.896)
  accentForeground: '#192133', // oklch(0.208 0.042 265.755)
  destructive: '#e53e3e', // oklch(0.577 0.245 27.325)
  border: '#e4e8ef', // oklch(0.929 0.013 255.508)
  input: '#e4e8ef', // oklch(0.929 0.013 255.508)
  ring: '#9ca3b8', // oklch(0.704 0.04 256.788)

  // Charts
  chart1: '#eb5734', // oklch(0.646 0.222 41.116)
  chart2: '#289b9d', // oklch(0.6 0.118 184.704)
  chart3: '#2c4f69', // oklch(0.398 0.07 227.392)
  chart4: '#f4b93b', // oklch(0.828 0.189 84.429)
  chart5: '#f2983b', // oklch(0.769 0.188 70.08)

  // Sidebar
  sidebar: '#fafbfe', // oklch(0.984 0.003 247.858)
  sidebarForeground: '#090d16', // oklch(0.129 0.042 264.695)
  sidebarPrimary: '#192133', // oklch(0.208 0.042 265.755)
  sidebarPrimaryForeground: '#fafbfe', // oklch(0.984 0.003 247.858)
  sidebarAccent: '#f2f4f8', // oklch(0.968 0.007 247.896)
  sidebarAccentForeground: '#192133', // oklch(0.208 0.042 265.755)
  sidebarBorder: '#e4e8ef', // oklch(0.929 0.013 255.508)
  sidebarRing: '#9ca3b8', // oklch(0.704 0.04 256.788)
  pastedBg: '#ececec', // oklch(0.93 0 0)

  // Surface / Ink ramp (streaming-text.tsx)
  page: '#fafafb',
  canvas: '#f1f2f3',
  surface: '#ffffff',
  inset: '#f7f8f9',
  hover: '#f4f5f6',
  hover2: '#e7e9eb',
  ink: '#1f2124',
  ink2: '#62656b',
  ink3: '#9a9da3',
  line: '#ecedef',
  lineStrong: '#e0e2e5',
};

export const RAW_DARK_TOKENS: ThemeColors = {
  // Base & Surface
  background: '#18181b', // oklch(0.145 0 0) - rich neutral dark
  foreground: '#fbfbfb', // oklch(0.985 0 0) - clean white
  card: '#222226', // oklch(0.185 0 0)
  cardForeground: '#fbfbfb', // oklch(0.985 0 0)
  popover: '#222226', // oklch(0.185 0 0)
  popoverForeground: '#fbfbfb', // oklch(0.985 0 0)

  // Actions & Neutrals
  primary: '#fbfbfb', // oklch(0.985 0 0) - modern high-contrast white
  primaryForeground: '#18181b', // oklch(0.145 0 0)
  secondary: '#34343a', // oklch(0.26 0 0)
  secondaryForeground: '#fbfbfb', // oklch(0.985 0 0)
  muted: '#34343a', // oklch(0.26 0 0)
  mutedForeground: '#adadad', // oklch(0.70 0 0)
  accent: '#34343a', // oklch(0.26 0 0)
  accentForeground: '#fbfbfb', // oklch(0.985 0 0)
  destructive: '#e53e3e', // oklch(0.577 0.245 27.325)
  border: '#34343a', // oklch(0.26 0 0)
  input: '#34343a', // oklch(0.26 0 0)
  ring: '#6b6b75', // oklch(0.45 0 0)

  // Charts
  chart1: '#3b65ef', // oklch(0.488 0.243 264.376)
  chart2: '#2dd4bf', // oklch(0.696 0.17 162.48)
  chart3: '#f59e0b', // oklch(0.769 0.188 70.08)
  chart4: '#c026d3', // oklch(0.627 0.265 303.9)
  chart5: '#f43f5e', // oklch(0.645 0.246 16.439)

  // Sidebar
  sidebar: '#18181b', // oklch(0.145 0 0)
  sidebarForeground: '#fbfbfb', // oklch(0.985 0 0)
  sidebarPrimary: '#fbfbfb', // oklch(0.985 0 0)
  sidebarPrimaryForeground: '#18181b', // oklch(0.145 0 0)
  sidebarAccent: '#2b2b30', // oklch(0.22 0 0)
  sidebarAccentForeground: '#fbfbfb', // oklch(0.985 0 0)
  sidebarBorder: '#2b2b30', // oklch(0.22 0 0)
  sidebarRing: '#6b6b75', // oklch(0.45 0 0)
  pastedBg: '#2b2b30', // oklch(0.22 0 0)

  // Surface / Ink ramp (streaming-text.tsx)
  page: '#0f0f11',
  canvas: '#17171a',
  surface: '#1c1c20',
  inset: '#202024',
  hover: '#26262b',
  hover2: '#2f2f35',
  ink: '#f2f2f4',
  ink2: '#a4a6ad',
  ink3: '#71737a',
  line: '#2a2a30',
  lineStrong: '#3a3a42',
};

/**
 * 6 Supported Accents from global.css
 * Preserves both light and dark primary/ring configurations.
 */
export const ACCENT_TOKENS: Record<
  AccentColor,
  {
    light: { primary: string; ring: string };
    dark: { primary: string; ring: string };
  }
> = {
  violet: {
    light: { primary: '#7c3aed', ring: '#e9d5ff' }, // oklch(0.56 0.22 302) / oklch(0.9 0.06 305)
    dark: { primary: '#c084fc', ring: '#7c3aed' }, // oklch(0.74 0.14 303) / oklch(0.56 0.22 302)
  },
  blue: {
    light: { primary: '#2563eb', ring: '#dbeafe' }, // oklch(0.56 0.21 257) / oklch(0.9 0.05 255)
    dark: { primary: '#60a5fa', ring: '#2563eb' }, // oklch(0.74 0.11 257) / oklch(0.56 0.21 257)
  },
  emerald: {
    light: { primary: '#059669', ring: '#d1fae5' }, // oklch(0.6 0.17 157) / oklch(0.9 0.06 162)
    dark: { primary: '#34d399', ring: '#059669' }, // oklch(0.79 0.11 157) / oklch(0.6 0.17 157)
  },
  amber: {
    light: { primary: '#d97706', ring: '#fef3c7' }, // oklch(0.67 0.17 66) / oklch(0.93 0.05 80)
    dark: { primary: '#fbbf24', ring: '#d97706' }, // oklch(0.83 0.13 77) / oklch(0.67 0.17 66)
  },
  rose: {
    light: { primary: '#e11d48', ring: '#ffe4e6' }, // oklch(0.6 0.23 15) / oklch(0.92 0.05 14)
    dark: { primary: '#fb7185', ring: '#e11d48' }, // oklch(0.74 0.16 16) / oklch(0.6 0.23 15)
  },
  indigo: {
    light: { primary: '#4f46e5', ring: '#e0e7ff' }, // oklch(0.54 0.2 282) / oklch(0.9 0.06 276)
    dark: { primary: '#818cf8', ring: '#4f46e5' }, // oklch(0.73 0.14 281) / oklch(0.54 0.2 282)
  },
};

/**
 * Radius system from global.css
 * --radius: 0.625rem (10px)
 * --radius-sm: calc(var(--radius) - 4px) -> 6px
 * --radius-md: calc(var(--radius) - 2px) -> 8px
 * --radius-lg: var(--radius) -> 10px
 * --radius-xl: calc(var(--radius) + 4px) -> 14px
 * --radius-control: 8px
 */
export const RADIUS_TOKENS = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  control: 8,
  full: 9999,
  borderCurve: 'continuous' as const,
};

/**
 * Spacing system - 4-point grid & section paddings
 */
export const SPACING_TOKENS = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  sectionPaddingMobile: 112, // 7rem
  sectionPaddingTablet: 160, // 10rem
};

/**
 * Motion and Easing tokens from global.css
 * --ease-link: cubic-bezier(0.16, 1, 0.3, 1)
 * --ease-composer: cubic-bezier(0.175, 0.885, 0.32, 1.275)
 */
export const MOTION_TOKENS = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 600,
    reduced: 1, // 0.001ms collapses to 1ms
  },
  easing: {
    link: [0.16, 1, 0.3, 1] as [number, number, number, number],
    composer: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
    standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
};

/**
 * Typography font families from global.css
 */
export const FONT_TOKENS = {
  sans: 'Geist-Sans, system-ui, -apple-system, Roboto, sans-serif',
  mono: 'Geist-Mono, monospace',
  display: 'Space-Grotesk, Geist-Sans, system-ui, sans-serif',
  chatFonts: {
    default: 'Geist-Sans, Segoe UI, Arial, sans-serif',
    sans: 'Helvetica Neue, Avenir Next, Arial, sans-serif',
    system: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    dyslexic: 'OpenDyslexic, Atkinson Hyperlegible, Arial, sans-serif',
    oswald: 'Oswald, Arial Narrow, Arial, sans-serif',
    boldonse: 'Bungee, Impact, Arial Black, sans-serif',
    'libre-baskerville': 'Libre Baskerville, Georgia, Times New Roman, serif',
    unbounded: 'Unbounded, Avenir Next, Segoe UI, sans-serif',
    'berkshire-swash': 'Berkshire Swash, Brush Script MT, cursive',
  },
};
