---
name: expo-router
description: Framework (OSS). Navigation and routing for Expo Router. Covers file-based routes, groups and dynamic routes, folder organization, Link with previews and context menus, native Stack, page titles, modals and form sheets, NativeTabs, headers and toolbars, and header search bars.
version: 1.0.1
license: MIT
---

# Expo Router Navigation

Navigation and routing for Expo Router apps. For screen styling, colors, controls, media, and visual effects, use the `expo-native-ui` skill; for motion and gestures, use `expo-animation`.

## Code Style

- Always use kebab-case for file names, e.g. `comment-card.tsx`
- Always remove old route files when moving or restructuring navigation
- Never use special characters in file names
- Configure tsconfig.json with path aliases, and prefer aliases over relative imports for refactors.

## Routes

- Routes belong in the `app` directory.
- Never co-locate components, types, or utilities in the app directory. This is an anti-pattern.
- Ensure the app always has a route that matches "/", it may be inside a group route.

## Navigation Principles

1. **Push goes deeper, replace moves on.** `router.push` when the user will want to return here; `router.replace` when coming back would land in a state the world has moved past; `router.dismissTo(href)` for finishing a flow.
2. **Presentation is meaning:**
   - Self-contained flow with steps: `presentation: 'modal'` with its own stack and Cancel/Done.
   - Short interruption (pickers, options): `formSheet` with detents.
   - Immersive view: `fullScreenModal` with explicit close.
   - Floating context: `transparentModal`.
3. **One-way doors leave the stack.** Finished onboarding, login, session complete: guard with replace so back navigation cannot re-enter completed states.
4. **Tabs are peers.** No slide between tabs; each tab maintains its own stack.
