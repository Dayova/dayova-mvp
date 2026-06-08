# Design System Context

This context covers shared UI components, styling conventions, tokens, themes, visual language, and design implementation patterns.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Existing Docs

- `docs/styling.md`
- `docs/bottom-sheets.md`

## Native controls

All app switches must use the universal Expo UI `Switch` from `@expo/ui`.
When a switch is embedded in a React Native screen, wrap it in `Host` from
`@expo/ui` with `matchContents`. Do not import or use `Switch` from
`react-native`.

Switches should keep Expo UI's default native styling unless a screen has a
specific documented design reason to do otherwise. This keeps the control
aligned with the latest OS-native switch behavior on iOS, Android, and web.

## Notes

- Capture reusable component and styling decisions here.
- Put design-system ADRs in `docs/contexts/design-system/adr/`.
