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
Android uses the Jetpack Compose switch with explicit Dayova primary colors so
Material You wallpaper colors cannot override the brand. iOS keeps the native
SwiftUI toggle shape and applies Dayova primary through the SwiftUI tint modifier.

## Styling Tokens

The app currently supports light mode only. The app background token is the
Figma off-white (`#F6F6F4`), surfaces use white, and Tailwind's standard spacing
scale is the source of truth for the 4px spacing system.

The Figma light palette is the source of truth: primary/system cyan `#00BAFF`,
primary strong/path 5 `#00A0E6`, path 7 `#4FD8FF`, primary text `#1A1A1A`,
secondary text `#697586`, border `#DCE6EE`, light 2 `#F3F6FA`, and light 3
`#FAFAFC`. The Figma orange `#FF9500` is the `wrong`/warning status color;
`destructive` remains a separate functional action/error token. Dark-mode
variables and classes should not be introduced until the dark-mode design is
finalized.

Typography uses Poppins only. Body text is Regular; headings, buttons, selected
tabs, labels that need emphasis, and other highlighted text use SemiBold. The
supported hierarchy is `heading-1` 32/48, `heading-2` 24/36, `body-1` 20/30,
`body-2` 16/24, `body-3` 14/21, `body-4` 12/18, and `body-5` 10/15, all with
0px letter spacing.

Light-mode pill buttons have exactly two visual appearances: the light-mode
gradient button and the black button using the primary text color `#1A1A1A`.
There are no white pill buttons in the current light-mode design system. Both
appearances are 56px tall with a 32px radius and a 0.3px inside stroke: gradient
buttons use the vertical light-mode gradient `#00A0E6` top to `#4FD8FF` bottom
with a white stroke, and black buttons use the light border token `#DCE6EE`.

Dark-mode design-system support is planned separately in
https://github.com/Dayova/dayova-mvp/issues/136. Do not add dark-mode tokens,
classes, or fallback button variants until that source of truth is finalized.

Icon-only close controls for sheets and modal chrome use the shared `CloseButton`
component: path 2 background (`#D7DCE3`) with path 3 icon (`#8A8D92`).

## Notes

- Capture reusable component and styling decisions here.
- Put design-system ADRs in `docs/contexts/design-system/adr/`.
