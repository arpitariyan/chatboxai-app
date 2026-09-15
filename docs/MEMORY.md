# ChatBox AI Mobile - Project Memory & Audit Log

> **NOTE FOR AI AGENTS:** This file is the primary memory log for the ChatBox AI project. Every agent working on this codebase MUST read this file first to understand the existing setup, source of truth, design system tokens, installed skills, and active rules. Any future updates MUST be recorded at the bottom of this file.

---

## 1. Project Baseline & State

- **App Name:** ChatBox AI (Mobile APK Project)
- **Framework:** Expo SDK 57 (`"expo": "~57.0.22"`, `"react-native": "0.86.3"`, `"react": "19.2.3"`)
- **TypeScript:** Version ~6.0.3 with strict mode enabled and `@/*` alias mapped to `./src/*`.
- **Current Active Feature:** Pure UI/UX Authentication Experience (`SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `ResetSuccessScreen`, `AuthContainer`).
- **Strict Boundary:** UI/UX Design ONLY. No backend APIs, no Firebase/OAuth connections, no database logic, no chat/AI execution engines built.

---

## 2. Design System Source of Truth

The visual identity of ChatBox AI originates from:
- **`src/styles/global.css`** (mirrored at `./global.css`)

### Preserved Design Tokens & Aesthetics:
- **Light & Dark Mode:** Off-white/slate light theme and rich neutral dark theme (`#18181b`, `#222226`, `#0f0f11`). Default theme set strictly to **Dark Mode** (`userInterfaceStyle: 'dark'` in app.json and `useThemeColors` defaults to `'dark'`).
- **NO NEON / GLOWING EFFECTS:** Strict design rule prohibiting bright neon borders, glowing neon shadows, and saturated gradients. All components use restrained 1px hairline borders (`#2a2a30`), clean inset backgrounds (`#202024`), and high-contrast solid buttons (`#fbfbfb`).
- **Surface & Ink Ramp:** `--page`, `--canvas`, `--surface`, `--inset`, `--hover`, `--hover-2`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--line-strong`.
- **6 Supported Accents:** `violet` (default), `blue`, `emerald`, `amber`, `rose`, `indigo`.
- **9 Chat Fonts:** `default`, `sans`, `system`, `dyslexic`, `oswald`, `boldonse`, `libre-baskerville`, `unbounded`, `berkshire-swash`.
- **Radius Language:** `0.625rem` (10px), `sm: 6px`, `md: 8px`, `lg: 10px`, `xl: 14px/16px`, `control: 8px`, `full: 9999px` paired with `borderCurve: 'continuous'`.
- **Touch Target Standard:** All interactive controls (buttons, inputs, provider pressables) are standardized to a comfortable **46px** height with subtle scale-press feedback (`transform: [{ scale: 0.985 }]`).
- **Motion System:** Easing curves (`--ease-link: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-composer: cubic-bezier(0.175, 0.885, 0.32, 1.275)`), spin slow, and reduced motion fallbacks.

---

## 3. Installed AI Mobile Design Skills

All skills live under `skills/` for universal AI discovery:

| Skill | Path | Description |
|---|---|---|
| `expo-design-system` | `skills/design-system/SKILL.md` | Expo design token architecture and drift audits |
| `expo-native-ui` | `skills/native-ui/SKILL.md` | Platform HIG/Material rules, controls, and safe layouts |
| `expo-router` | `skills/router/SKILL.md` | Native stack, file-based routes, and presentation modes |
| `expo-ui` | `skills/expo-ui/SKILL.md` | Universal `@expo/ui` native SwiftUI/Compose controls |
| `mobile-design` | `skills/mobile-design/SKILL.md` | Polish standards, 8-state completeness, and mobile UX |
| `expo-animation` | `skills/animation/SKILL.md` | Reanimated UI-thread motion & reduced motion rules |
| `app-design-review` | `skills/app-design-review/SKILL.md` | Anti-slop rules, touch targets, and design review |

---

## 4. Mobile Token Bridge (`src/theme/`)

The design tokens are bridged into TypeScript under `src/theme/`:

```
src/theme/
├── types.ts        # Strict Theme, Colors, Spacing, Radius, Typography, Motion interfaces
├── tokens.ts       # Raw & semantic tokens for Light, Dark, and all 6 Accents
├── colors.ts       # getColors helper, useThemeColors hook (strictly defaults to dark mode), lightColors, darkColors
├── spacing.ts      # 4-point spacing scale & compact mode multipliers
├── radius.ts       # Radius tokens with borderCurve: 'continuous'
├── typography.ts   # Font sizes, weights, line heights, chat font resolver, tabularNums
├── motion.ts       # Easing vectors, duration constants, spring configs
└── index.ts        # Unified re-export and createTheme builder
```

---

## 5. Authentication UI Components & Assets

```
assets/images/
├── logo.png               # Chatboxai_logo_main_2.png
├── google.png             # Google provider logo from app_logo_connection
├── github.png             # GitHub provider logo from app_logo_connection
└── microsoft.png          # Microsoft provider logo from app_logo_connection

src/components/auth/
├── AuthHeader.tsx         # Hero ChatBox AI brand logo image (prominent, prominent 150px wide display)
├── SocialAuthButtons.tsx  # Google, GitHub, Microsoft provider buttons with real logo images
├── AuthDivider.tsx        # Elegant "OR" divider
├── AuthInput.tsx          # Text/Email input field (focus, filled, error, disabled)
├── PasswordInput.tsx      # Password input field with show/hide toggle
├── AuthButton.tsx         # Primary CTA button with loading & disabled states
├── AuthFooterLink.tsx     # Secondary navigation link component
├── AuthCard.tsx           # Controlled surface container (maxWidth 420px, 16px radius)
└── AuthSuccessState.tsx   # Password reset email confirmation state

src/features/auth/
├── SignInScreen.tsx           # Sign In screen
├── SignUpScreen.tsx           # Sign Up screen
├── ForgotPasswordScreen.tsx   # Forgot Password screen
├── ResetSuccessScreen.tsx     # Password Reset Success screen
├── AuthContainer.tsx          # Clean Auth Container
└── index.ts                   # Unified re-export
```

---

## 6. Documentation Map (`docs/`)

- `docs/MEMORY.md` — Project memory log (this file).
- `docs/design-system.md` — Complete token reference and consumption guide.
- `docs/mobile-design-guidelines.md` — Mobile design principles and 10 anti-drift rules.

---

## 7. Change History Log

### Session 1 — Initial Setup & Design System Foundation
- Created `src/styles/global.css`, `skills/`, `src/theme/`, `tsconfig.json`, `package.json`, `docs/MEMORY.md`.

### Session 2 — Authentication UI/UX Design System
- Built 9 reusable auth UI components and 4 auth screens (`SignInScreen`, `SignUpScreen`, `ForgotPasswordScreen`, `ResetSuccessScreen`).

### Session 3 — Polish, Dark Mode Default & Asset Integration
- Removed debug toolbar from `AuthContainer.tsx`.
- Integrated ChatBox AI logo & provider icons (`Google`, `GitHub`, `Microsoft`).

### Session 4 — Strict Dark Mode Fix
- Updated `app.json` (`"userInterfaceStyle": "dark"`).
- Updated `src/theme/colors.ts`: Fixed `useThemeColors` hook and `getColors` to default strictly to Dark Mode (`forcedScheme || 'dark'`) regardless of device light mode setting.

### Session 5 — Ultra-Refined Minimalist Design Polish (No Glowing Effects)
- Zero Glowing Effects rules, 46px touch target heights, micro-scale press feedback, 16px squircle card radius.

### Session 6 — AuthHeader Brand Hero Display Optimization
- **Removed Outer Box Wrapper**: Removed `logoBox` container around the brand logo image.
- **Removed Redundant Text**: Removed duplicate `CHATBOX AI` text under logo (since `logo.png` image already contains full ChatBox AI brand typography).
- **Hero Logo Display**: Displayed hero logo image at `150px` width & `52px` height prominently at the top of `AuthHeader.tsx`.
- **Updated `docs/MEMORY.md`**: Recorded Session 6 log.
