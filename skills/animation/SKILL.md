---
name: expo-animation
description: Framework (OSS). Build animations in React Native and Expo, making decisions that survive strict review on real devices. Covers Reanimated worklets, Gesture Handler, layout animations, spring configs, and reduced motion.
version: 1.0.0
license: MIT
---

# Building Animations in Expo

## Operating Principles

1. **Gate the Frequency:**
   - 100+ times/day (tab switches, keyboard, basic scrolling): No custom slide; use platform defaults.
   - Tens of times/day (press feedback, list select): Sub-150ms instant feedback.
   - Occasional (sheets, modals): Standard easing / spring transitions.
   - Rare (first-run, success state celebration): Delight budget.
2. **Runtime Discipline:**
   - Keep motion on the UI runtime (Reanimated worklets).
   - Never run animation loops on the JS thread.
   - Prefer `transform` and `opacity` (composite-only properties) over layout-triggering properties (`width`, `height`, `padding`, `margin`).
3. **Reduced Motion:**
   - Always respect `prefers-reduced-motion` and user settings.
   - When reduced motion is active, duration collapses to 0/1ms and animations resolve immediately.
