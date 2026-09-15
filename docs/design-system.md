# ChatBox AI - Mobile Design System Documentation

## 1. Source of Truth
The primary source of truth for the ChatBox AI visual system is:
- **`src/styles/global.css`** (referenced also at `./global.css`)

All colors, surface ramps, ink scales, accents, typography, radius values, and motion specifications originate here.

---

## 2. Token Architecture & Mobile Bridge
The tokens are mapped into a native TypeScript bridge under **`src/theme/`**:

```
src/theme/
├── types.ts        # Strict TypeScript interfaces (ThemeColors, ThemeSpacing, etc.)
├── tokens.ts       # Raw token definitions mirroring global.css
├── colors.ts       # Semantic color getters, light/dark resolution, useThemeColors hook
├── spacing.ts      # 4-point spacing grid & compact mode specs
├── radius.ts       # Radius scale with continuous border curves
├── typography.ts   # Font sizes, families, weights, and chat fonts
├── motion.ts       # Easing curves (easeLink, easeComposer) and duration constants
└── index.ts        # Unified re-export and createTheme helper
```

---

## 3. Light & Dark Mode
- **Light Mode:** Crisp off-white and canvas surfaces (`--page: #fafafb`, `--surface: #ffffff`, `--ink: #1f2124`) with deep slate foregrounds.
- **Dark Mode:** Deep neutral dark surfaces (`--background: #18181b`, `--card: #222226`, `--page: #0f0f11`, `--ink: #f2f2f4`) with high-contrast white primaries.
- Both themes are available dynamically through `useThemeColors()` or statically via `lightColors` / `darkColors`.

---

## 4. Accent System
ChatBox AI supports 6 official accent themes for both Light and Dark mode:
1. **violet** (Default) - Light: `#7c3aed`, Dark: `#c084fc`
2. **blue** - Light: `#2563eb`, Dark: `#60a5fa`
3. **emerald** - Light: `#059669`, Dark: `#34d399`
4. **amber** - Light: `#d97706`, Dark: `#fbbf24`
5. **rose** - Light: `#e11d48`, Dark: `#fb7185`
6. **indigo** - Light: `#4f46e5`, Dark: `#818cf8`

Accents dynamically control `--primary` and `--ring` while keeping all neutral surfaces intact.

---

## 5. Typography Scale & Chat Fonts
- Base fonts: `Geist Sans`, `Geist Mono`, and `Space Grotesk` (headings).
- 9 selectable chat font profiles are preserved:
  - `default`, `sans`, `system`, `dyslexic`, `oswald`, `boldonse`, `libre-baskerville`, `unbounded`, `berkshire-swash`.
- Number formatting uses `tabularNums` (`fontVariant: ['tabular-nums']`).

---

## 6. Radius & Motion
- **Radius:**
  - `sm: 6px`, `md: 8px`, `lg: 10px`, `xl: 14px`, `control: 8px`, `full: 9999px`
  - Always pair with `borderCurve: 'continuous'` for smooth squircle corners.
- **Motion:**
  - `easeLink`: `cubic-bezier(0.16, 1, 0.3, 1)`
  - `easeComposer`: `cubic-bezier(0.175, 0.885, 0.32, 1.275)`
  - Durations: `fast` (150ms), `normal` (300ms), `slow` (600ms).
  - Reduced-motion mode collapses transition durations to instant (0/1ms).

---

## 7. How Future Mobile Components Should Consume Tokens

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors, spacing, radius, typography } from '@/theme';

export function ExampleCard() {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderRadius: radius.control,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.ink }]}>
        Native Mobile Card
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderCurve: radius.borderCurve,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
```
