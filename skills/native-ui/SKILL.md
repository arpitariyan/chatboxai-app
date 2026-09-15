---
name: expo-native-ui
description: Framework (OSS). Build beautiful, native-feeling Expo screens. Covers Apple HIG styling, semantic colors, native controls, SF Symbols, media, visual effects, gradients, storage, and responsive layout. For routing and navigation, use the expo-router skill; for motion and animation, use the expo-animation skill.
version: 1.1.1
license: MIT
---

# Expo Native UI Guidelines

For routes, links, stacks, tabs, modals, sheets, and headers, use the `expo-router` skill. For any motion — entering/exiting, gestures, springs, keyboard-driven UI — use the `expo-animation` skill.

> **Before picking any UI component, check `expo-ui` first.** `@expo/ui` provides native equivalents — BottomSheet, Button, Picker, Slider, Menu, Section, Switch, SegmentedControl, and more — rendered as real SwiftUI on iOS and Jetpack Compose on Android, available in Expo Go on SDK 56+ with no custom build. Load the **`expo-ui`** skill to find the right component before falling back to React Native built-ins or community libraries. This skill (`expo-native-ui`) covers the surrounding structure: Expo Router navigation, layout, styling, and visual effects.

## Running the App

**CRITICAL: Always try Expo Go first before creating custom builds.**

Most Expo apps work in Expo Go without any custom native code. Before running `npx expo run:ios` or `npx expo run:android`:

1. **Start with Expo Go**: Run `npx expo start` and scan the QR code with Expo Go
2. **Check if features work**: Test your app thoroughly in Expo Go
3. **Only create custom builds when required**

## Code Style

- Be cautious of unterminated strings. Ensure nested backticks are escaped; never forget to escape quotes correctly.
- Always use import statements at the top of the file.
- Always use kebab-case for file names, e.g. `comment-card.tsx`
- Never use special characters in file names.
- Configure tsconfig.json with path aliases, and prefer aliases over relative imports for refactors.

## Library Preferences

- **For any sheet, picker, slider, toggle, menu, or grouped-form section: use `@expo/ui` (see `expo-ui` skill) before reaching for a React Native built-in or community library** — it renders native SwiftUI/Compose and works in Expo Go on SDK 56+. For grouped/settings-style rows (short, fixed-length), use `@expo/ui`'s `List` + `ListItem`. For large or unknown-length scrolling lists (feeds, search results, catalogs), use `FlatList` or `FlashList` — `@expo/ui`'s `List` is not virtualized.
- Never use modules removed from React Native such as Picker, WebView, SafeAreaView, or AsyncStorage.
- `react-native-safe-area-context` not react-native SafeAreaView.
- `process.env.EXPO_OS` not `Platform.OS`.
- `React.use` not `React.useContext`.
- `expo-image` Image component instead of intrinsic element `img`.
- `expo-glass-effect` for liquid glass backdrops.
- `Color` from `expo-router` for native semantic colors, not raw `PlatformColor` (type-safe, auto-adapts to light/dark).
- In SDK 56+, never import from `@react-navigation/*` directly — use `expo-router/react-navigation` instead.

## Responsiveness

- Wrap screens with scrollable content in a ScrollView. Screens where all content is guaranteed to fit may use View.
- Avoid hardcoded dimensions; use flexbox, gap, and percentages.
- Handle safe areas with `useSafeAreaInsets()`.
