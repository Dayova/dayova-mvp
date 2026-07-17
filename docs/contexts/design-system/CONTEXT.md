# Design System Context

This context covers shared UI components, styling conventions, tokens, themes, visual language, and design implementation patterns.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Current Design Delivery Model

Effective 14 July 2026, existing Figma work is a visual reference and baseline,
not a required approval, sequencing, or release gate. Jakob Rössner and Fabius
Schurig may make product-design, UI, and UX decisions and implement them
directly. Record deliberate changes in Linear and update the app's semantic
tokens and repository guidance; any later Figma reconciliation is non-blocking
unless the team explicitly supersedes this temporary model.

- [Notion decision record](https://app.notion.com/p/39d2e87228bf8081b08aff1b2990b860)
- [DAY-171: Hugeicons implementation policy](https://linear.app/dayova/issue/DAY-171/define-the-long-term-figma-to-app-icon-synchronization-policy)

## Existing Docs

- `docs/styling.md`
- `docs/bottom-sheets.md`
- `docs/accessibility.md`

## Native controls

All app switches must use `Switch` from `src/components/ui/switch`. Do not
import or use `Switch` from `react-native`, and do not render Expo UI switches
directly from app screens.

The app `Switch` owns the platform-native control and its accessible switch
semantics. Android uses React Native's platform switch with explicit Dayova
colors and app-owned sizing; do not move it into an Expo UI Jetpack Compose
`Host`, because Compose content is disposed before an outgoing native-stack
screen finishes its pop transition. iOS keeps the native SwiftUI toggle shape
and applies Dayova primary through the SwiftUI tint modifier.

App screens that collect a date or time must use `DateTimePickerSheet` from
`src/components/ui/date-time-picker-sheet`. Do not import the underlying Expo UI
picker directly from a screen. The wrapper owns platform display normalization,
German locale, safe-area handling, and native presentation.

## Icons

Hugeicons is the standard icon source for app interface icons. Add the selected
glyph from `@hugeicons/core-free-icons` to the semantic wrapper in
`src/components/ui/icon.tsx`, then import that wrapper from app code instead of
importing icon packages or custom assets directly.

Code review must verify icon provenance by checking that the semantic wrapper
maps to the intended Hugeicons export. At each usage, also review the icon's
size, stroke weight, color, alignment, and whether it is decorative or needs an
accessible label.

Custom SVGs, platform symbols, or icons from another source are exceptions.
Each exception requires an explicit Linear issue and a repo-local rationale
explaining why Hugeicons cannot meet the requirement. Link that rationale from
the implementation or an ADR; reviewers should reject untracked custom icon
assets.

## Styling Tokens

The app supports light, dark, and system theme preferences. The light app
background token is the Figma off-white (`#F6F6F4`), surfaces use white, and
Tailwind's standard spacing scale is the source of truth for the 4px spacing
system. Dark mode keeps Dayova's cyan/purple/status hues and changes neutral
background, surface, border, muted, path, and text tokens to a warm dark
hierarchy.

The current light-palette baseline, also recorded in Figma, is: background `#F6F6F4`, light 1
`#FFFFFF`, light 2 `#F3F6FA`, light 3 `#FAFAFC`, border `#DCE6EE`, path 1/2
`#D7DCE3`, path 3 `#8A8D92`, path 4/secondary text `#697586`, path 5/primary
strong `#00A0E6`, path 6/primary/system cyan `#00BAFF`, path 7 `#4FD8FF`, and
primary text `#1A1A1A`. The current orange `#FF9500` is the `wrong` status color;
`destructive` remains a separate functional action/error token. Dark-mode
variables, runtime colors, and the light/system/dark preference are already
implemented; the remaining cross-screen and real-device completion audit is
tracked in
[DAY-101](https://linear.app/dayova/issue/DAY-101/audit-and-complete-dark-mode-design-system-support).

Badge fills use wrong `#FF9500`, info `#C9A100`, system `#00BAFF`, success
`#34C759`, theorie `#5856D6`, ueben `#AF52DE`, praxis `#00C7BE`, and
hausaufgabe `#B88AAE`. Current badge subtle fills are: wrong
`#FFECD6`, info `#FFF8CC`, system `#F1F7FB`, success `#EAFFF1`, theorie
`#EEECFF`, ueben `#F4ECFF`, praxis `#E7FBF6`, and hausaufgabe `#F3E8F0`.

Do not add `*-foreground` color partners without an explicit design-system
decision that introduces them as real semantic palette tokens. Use the palette
directly: `text-text` for primary text, `text-secondary-text` for secondary
text, and `text-white` for white text on dark or saturated surfaces.

Typography uses Poppins only. Body text is Regular; headings, buttons, selected
tabs, labels that need emphasis, and other highlighted text use SemiBold. The
supported hierarchy is `heading-1` 32/48, `heading-2` 24/36, `body-1` 20/30,
`body-2` 16/24, `body-3` 14/21, `body-4` 12/18, and `body-5` 10/15, all with
0px letter spacing.

Light-mode pill buttons have exactly two visual appearances: the light-mode
gradient button and the black button using the primary text color `#1A1A1A`.
There are no white pill buttons in the current light-mode design system. Both
appearances are 56px tall with a 44px radius and a 0.3px inside stroke: gradient
buttons use the vertical light-mode gradient `#00A0E6` top to `#4FD8FF` bottom
with a white stroke, and black buttons use the light border token `#DCE6EE`.

The current app corner system is: info/small boxes use 24px, 345px-wide
rectangles and card-like surfaces use 32px, and buttons use 44px. Device frame
radii are not app tokens because they depend on the phone/mockup. When nesting
rounded surfaces, the outer radius equals the inner radius plus the padding
between them.

Dark-mode tokens live in `src/global.css` and native runtime color mirrors live
in `src/lib/theme.ts`. Theme preference handling lives in
`src/lib/theme-preference.ts`; settings should expose the existing light,
system, and dark options rather than introducing another toggle model.

Icon-only close controls for sheets and modal chrome use the shared `CloseButton`
component: path 2 background (`#D7DCE3`) with path 3 icon (`#8A8D92`).

## Notes

- Capture reusable component and styling decisions here.
- Put design-system ADRs in `docs/contexts/design-system/adr/`.
- Use NativeWind for static app UI. Follow the rendering-choice matrix in
  `docs/styling.md` when deciding between NativeWind, RN geometry styles, SVGs,
  and native artwork modules.
