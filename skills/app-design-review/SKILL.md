---
name: app-design-review
description: Mobile app design review, anti-slop audit, and polish standards (Expo / React Native). Enforces Apple HIG / Material Design 3 fidelity, semantic color integrity, anti-slop discipline, native navigation behavior, touch targets, and typography rules.
version: 1.3.0
license: MIT
---

# App Design Review & Anti-Slop Audit

Enforces production-grade mobile standards to prevent generic AI-generated interfaces.

## The 10 Anti-Slop Mobile Laws

1. **Never Invent One-Off Colors:** Every color must resolve to an existing semantic design token.
2. **Never Rebuild Native Controls:** Use platform pickers, native switches, and system sheets rather than custom approximations.
3. **No Fake Web Modals:** Full-screen views must use proper navigation stacks; short sheets must use `formSheet` or `@expo/ui` BottomSheet.
4. **No Card Inflation ("Everything's a Card"):** Group content with inset grouping or dividers, not endless nested cards with heavy borders.
5. **No Neon / Excessive Gradients:** Keep color accents purposeful and restrained. Avoid multi-stop bright gradients behind text.
6. **No Fixed Magic Dimensions:** Never hardcode pixel widths or notch heights. Use `useWindowDimensions()` and `useSafeAreaInsets()`.
7. **Consistent Corner Radii:** Use the tokenized radius scale (`sm`, `md`, `lg`, `control`). Always enable continuous corners (`borderCurve: 'continuous'`).
8. **Thumb-Friendly Touch Targets:** Minimum 44x44 pt touch targets for all interactive controls.
9. **Typography Hierarchy:** Stick to the type scale; never mix random font sizes or multiple icon libraries.
10. **State Completeness:** Verify every screen in Light Mode, Dark Mode, Loading state, Empty state, and Error state before declaring it complete.
