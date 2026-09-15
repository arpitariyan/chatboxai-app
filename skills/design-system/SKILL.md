---
name: expo-design-system
description: Framework (OSS). Build and maintain a design system inside an Expo app - a reusable theme of design tokens (color, spacing, typography, radius, shadow, motion), reusable component structure with variant/size/state prop conventions, and rules for when to extract a repeated view into a shared component. Use when creating or organizing theme files and design tokens (theme.ts / theme/), extending an existing theme or styling library (NativeWind, Tamagui, Restyle, Unistyles) in its own idiom, standardizing styles so screens (including AI-generated ones) look consistent and polished, fixing an app that looks AI-generated or generic instead of native, building an in-app component library, or auditing an app for design-system drift (hardcoded colors, spacing, fonts). For platform styling specifics (semantic colors, HIG rules, native controls) use expo-native-ui; for folder layout of a new app use expo-project-structure.
version: 1.0.0
license: MIT
---

# Expo Design Systems

Make every screen in an app draw from one visual source of truth: a token theme and a small set of reusable components. This skill defines where tokens live, what they cover, how reusable components are shaped, and when a repeated view earns promotion into the system.

Sibling skills own the layers around this one:

- `expo-native-ui` - platform styling rules (HIG, semantic colors, controls, shadows syntax). Follow it for **what values look native**; follow this skill for **where values live and how they're reused**.
- `expo-project-structure` - folder skeleton for new apps.

For Tailwind projects, keep tokens in `global.css` as CSS variables and follow the styling library's own setup guidance. The scales and naming in this skill still apply; only the storage format changes.

## Adopt Before You Build

In an app that already has screens or established styles, the first move is detection, not construction. Before writing any token file:

1. **Look for a declared system.** Check `package.json` for a styling library - NativeWind/Tailwind, Tamagui, Restyle, Unistyles, styled-components. Then look for a token file: `global.css`, `theme.ts`, `src/theme/`, `constants/theme.ts`, or `constants/Colors.ts`.
2. **If one exists, it is the source of truth.** Extend it in its own idiom - its names, its scale, its storage format. Audit drift against that system, not against generic examples.
3. **If only de facto values exist** - the same greys and paddings repeated across screens, no theme file - there is no system yet. Derive tokens from the most frequent ones, snapped to the 4-point grid.
4. **Never introduce a second system beside an existing one.** A fresh `src/theme/` next to an existing token file or global.css without integration is design-system drift, not adoption.

## The Theme Architecture

All design tokens live under `src/theme/`.

```
src/theme/
  tokens.ts       # Raw primitive tokens, color mappings, source-of-truth bridge
  colors.ts       # Semantic colors, light/dark themes, accent modes
  spacing.ts      # 4-point spacing scale (xs, sm, md, lg, xl, 2xl)
  typography.ts   # Font families, sizes, line heights, weights
  radius.ts       # Radius scale (sm, md, lg, xl, control, full)
  motion.ts       # Easing curves, durations, spring configs, reduced motion
  types.ts        # TypeScript types for themes, tokens, and options
  index.ts        # Unified re-export: import { theme, useTheme } from "@/theme"
```

Rules that make a theme worth having:

- **Every repeated visual value is a token.** A literal that appears twice belongs in the theme.
- **Components import tokens; screens import components.** A screen file that imports `spacing` for layout padding is fine; a screen file redefining a button color is drift.
- **Never hardcode** hex colors, font sizes, or spacing multiples outside `src/theme/`. One-off values that are genuinely local (an icon's 17px optical nudge) may stay inline - with a comment saying why.
