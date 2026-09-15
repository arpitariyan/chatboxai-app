---
name: mobile-design
description: Design-grade mobile UI skill. Builds polished, production-quality, native-feeling mobile screens and components across React Native / Expo, Android (Jetpack Compose), and iOS (SwiftUI). Grounded in Material Design 3, Apple Human Interface Guidelines, and real-world app layout patterns.
version: 1.0.0
license: MIT
---

# Mobile Design

Build mobile UI that looks **intentional, native, and shipped** — not generic AI/Bootstrap mush.

## Core Rules for Mobile Design

1. **Hierarchy & Density:**
   - Rank elements: Primary / Secondary / Tertiary.
   - One primary action per visual area.
   - Use hierarchical spacing, not uniform gaps.
2. **Native Touch Targets:**
   - Minimum 44x44 pt (iOS) / 48x48 dp (Android) for all tap targets.
3. **Typography Voice:**
   - Establish clear type ramp (display, heading, label, body, mono).
   - Use tabular numbers (`fontVariant: ['tabular-nums']`) for counters, dates, tokens, and timers.
4. **Platform Harmony:**
   - Honor platform conventions (Android back button, iOS swipe-to-back).
   - Continuous corner curves (`borderCurve: 'continuous'`).
   - Dynamic Island / notch / navigation bar safe insets.
5. **State Completeness:**
   - Every surface must define 8 states:
     - Initial
     - Loading / Skeleton
     - Empty (with actionable recovery)
     - Error (with retry mechanism)
     - Success / Populated
     - Submitting / Disabled
     - Offline awareness
