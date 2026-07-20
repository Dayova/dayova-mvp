# Expo Mobile App Context

This context covers the Expo app, Expo Router, navigation, native UI, styling, client state, and mobile-specific behavior.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Language

**User-facing error message**:
A German, actionable message shown to the learner when they can recover by changing their input or trying a clear next step.
_Avoid_: Called by client, Server Error, raw stack trace

## Existing Docs

- `docs/bottom-sheets.md`
- `docs/styling.md`
- `modules/dayova-system-appearance/README.md` for the iOS appearance bridge,
  its rationale, native contract, alternatives, validation matrix, and removal
  criteria.
- `patches/README.md` for patched package behavior that affects Expo/Metro
  builds, including the NativeWind release-build patch.

## Notes

- Capture app architecture, routing, UI, and native behavior decisions here.
- Put mobile-app ADRs in `docs/contexts/mobile-app/adr/`.
- NativeWind is part of the build pipeline, not only runtime styling. Release
  build issues around Metro, Tailwind generation, or `expo-updates` should check
  `metro.config.js` and the NativeWind patch documentation before changing EAS
  profiles.
