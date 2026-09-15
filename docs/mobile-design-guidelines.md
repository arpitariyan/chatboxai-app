# ChatBox AI - Mobile Design & Anti-Drift Guidelines

This document establishes the official design standards, ergonomics, and anti-drift rules for future mobile development of the ChatBox AI APK.

---

## 1. Core Mobile-First UX Principles

1. **Hierarchy & Visual Restraint:**
   - Strict visual hierarchy: Primary, Secondary, and Tertiary elements.
   - Avoid visual noise, excessive neon glows, arbitrary 3D elements, or template-like AI mush.
   - Clean surfaces with intentional contrast ratios.
2. **Thumb-Friendly Touch Targets:**
   - Minimum 44x44 pt (iOS) / 48x48 dp (Android) for all interactive buttons and icons.
   - Important action targets should be placed in thumb-reachable lower screen zones.
3. **Typography Voice:**
   - Use the centralized type ramp from `src/theme/typography.ts`.
   - Use tabular numbers (`fontVariant: ['tabular-nums']`) for counters, timers, message timestamps, and tokens.
4. **Platform Harmony & Safe Areas:**
   - Use `react-native-safe-area-context` (`useSafeAreaInsets`) for notches, dynamic islands, status bars, and home indicators.
   - Respect system gestures (iOS swipe-from-edge, Android hardware back).
   - Use continuous corner curves (`borderCurve: 'continuous'`).
5. **State Completeness:**
   Every screen and list must explicitly account for all 7 standard states:
   - Initial / Idle
   - Loading / Skeleton
   - Populated / Success
   - Empty (informative with a call to action)
   - Error (human-readable with retry trigger)
   - Disabled / Submitting
   - Offline awareness

---

## 2. Strict Anti-Drift Rules

- **RULE 1:** Never invent a new color when an existing semantic token can be used.
- **RULE 2:** Never hardcode repeated visual values (spacing, radius, hex colors) outside `src/theme/`.
- **RULE 3:** Never create duplicate design tokens or competing theme files.
- **RULE 4:** Never create a second competing design system.
- **RULE 5:** Never change `global.css` values without explicit approval.
- **RULE 6:** Never replace the ChatBox AI visual identity with generic framework defaults.
- **RULE 7:** Never blindly copy Material, iOS, shadcn, or another design language over ChatBox AI's tokens.
- **RULE 8:** Use platform conventions while preserving ChatBox AI's core brand identity.
- **RULE 9:** Prefer reusable components over screen-specific one-off styling.
- **RULE 10:** All future screens must inherit from the centralized design system (`src/theme`).
