# Design System Context

This context covers shared UI components, styling conventions, tokens, themes, visual language, and design implementation patterns.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Existing Docs

- `docs/styling.md`
- `docs/bottom-sheets.md`

## Native controls

All app switches must use `Switch` from `src/components/ui/switch`. Do not
import or use `Switch` from `react-native`, and do not render Expo UI switches
directly from app screens.

The app `Switch` wraps Expo UI native controls with `Host matchContents`.
Android uses the Jetpack Compose switch with explicit Dayova-blue colors so
Material You wallpaper colors cannot override the brand. iOS keeps the native
SwiftUI toggle shape and applies Dayova blue through the SwiftUI tint modifier.

## Notes

- Capture reusable component and styling decisions here.
- Put design-system ADRs in `docs/contexts/design-system/adr/`.
