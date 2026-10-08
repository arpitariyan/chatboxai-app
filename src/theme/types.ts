/**
 * ChatBox AI Mobile Design System - Types
 * Source of truth: src/styles/global.css
 */

export type ColorScheme = 'light' | 'dark';

export type AccentColor = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo';

export type ChatFont =
  | 'default'
  | 'sans'
  | 'system'
  | 'dyslexic'
  | 'oswald'
  | 'boldonse'
  | 'libre-baskerville'
  | 'unbounded'
  | 'berkshire-swash';

export interface ThemeColors {
  // Core UI semantic tokens
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;

  // Charts
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;

  // Sidebar tokens
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  pastedBg: string;

  // Surface / Ink ramp (components/ui/streaming-text.tsx)
  page: string;
  canvas: string;
  surface: string;
  surface2: string;
  inset: string;
  hover: string;
  hover2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  line2: string;
  lineStrong: string;
  isDark: boolean;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  sectionPaddingMobile: number;
  sectionPaddingTablet: number;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  control: number;
  full: number;
  borderCurve: 'continuous';
}

export interface ThemeTypography {
  fontFamily: {
    sans: string;
    mono: string;
    display: string;
    chatFonts: Record<ChatFont, string>;
  };
  fontSize: {
    xs: number;
    sm: number;
    base: number;
    md: number;
    lg: number;
    xl: number;
    '2xl': number;
    '3xl': number;
    '4xl': number;
    landingHeadingLg: number;
    landingHeadingXl: number;
  };
  fontWeight: {
    normal: '400';
    medium: '500';
    semibold: '600';
    bold: '700';
  };
  lineHeight: {
    tight: number;
    snug: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeMotion {
  duration: {
    fast: number;
    normal: number;
    slow: number;
    reduced: number;
  };
  easing: {
    link: [number, number, number, number];
    composer: [number, number, number, number];
    standard: [number, number, number, number];
  };
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  typography: ThemeTypography;
  motion: ThemeMotion;
  isDark: boolean;
  accent: AccentColor;
  chatFont: ChatFont;
}
