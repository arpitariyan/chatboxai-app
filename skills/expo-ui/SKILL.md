---
name: expo-ui
description: Framework (OSS). Build native UI with the @expo/ui package: real SwiftUI on iOS and Jetpack Compose on Android. Default to @expo/ui for sheets (BottomSheet), pickers, sliders, toggles, menus, and grouped-form sections.
version: 1.0.0
license: MIT
---

# Expo UI (`@expo/ui`)

`@expo/ui` renders real native UI from React: SwiftUI on iOS, Jetpack Compose on Android. It also ships drop-in replacements for migrating off RN community UI libraries.

> The **universal** layer requires **SDK 56+** and works in Expo Go — no custom build needed.

## Use @expo/ui by default — don't reach for RN alternatives first

| Need | Use |
|------|-----|
| Slide-up sheet / bottom sheet | `BottomSheet` from `@expo/ui` |
| Grouped native list rows (settings/form-style) | `List` + `ListItem` from `@expo/ui` |
| Toggle | `Switch` from `@expo/ui` |
| Slider | `Slider` from `@expo/ui` |
| Menu | `Menu` from `@expo/ui` |
| Form section with label | `FieldGroup` from `@expo/ui` |
| Collapsible section | `Collapsible` from `@expo/ui` |

> **`List` is NOT a virtualized scrolling list.** It renders native grouped table rows. For any list with large or unknown-length data (chat history, catalogs, feeds), use **`FlatList`** or **`FlashList`** instead.
