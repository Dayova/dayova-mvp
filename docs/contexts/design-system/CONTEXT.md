# Design System Context

This context covers shared UI components, styling conventions, tokens, themes, visual language, and design implementation patterns.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology, conventions, and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

## Language

**Content-size resilience**:
Dayova's quality contract for every portrait phone and tablet layout across system text and display sizing: default sizing stays visually identical to the approved baseline, while non-default sizes may reflow, stack, grow, or vertically scroll but must remain polished, complete, and fully usable. Screens stay bounded to the portrait viewport; horizontal scrolling remains valid only where it is an intentional part of an inherently horizontal component, never as a workaround for larger text or display sizing. Meaningful copy and actions remain present at their system-scaled size and reflow vertically; intentional ellipsis is valid only when the complete value remains accessible. Semantic display headings use Dayova's shared native-style large-title curve (currently a 1.75 maximum multiplier), while body copy, controls, field values, errors, and supporting text continue to receive the user's full text-size preference. This heading-only curve prevents custom Poppins display type from growing linearly to roughly three times its base size and splitting ordinary German words into isolated fragments at AXXXL. Portrait-tablet compatibility keeps the phone information architecture in a centered, bounded-width single column and changes only behavior that is buggy or visibly awkward. Dedicated tablet composition, navigation, information density, landscape, split-screen, and foldable postures are separate product modes.
_Avoid_: Pixel-identical layouts at every accessibility size, merely fitting without visual quality, clipping content, arbitrary screen-local text caps, shrinking or capping body/action/error content, hiding actions, inaccessible truncation, disabling system scaling, screen-level horizontal scrolling, treating portrait tablet compatibility as a dedicated tablet mode

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
semantics. Android uses the Expo UI Jetpack Compose Material 3 switch with
explicit Dayova colors so Material You wallpaper colors cannot override the
brand. Keep `expo-modules-core` at 56.0.18 or newer: the upstream lifecycle fix
in [Expo #47099](https://github.com/expo/expo/pull/47099) keeps Compose content
visible until an outgoing `react-native-screens` pop transition finishes. iOS
keeps the native SwiftUI toggle shape and applies Dayova primary through the
SwiftUI tint modifier.

App screens that collect a date or time in one interaction must use
`DateTimePickerSheet` from `src/components/ui/date-time-picker-sheet`. Do not
import the underlying Expo UI picker directly from a screen. The wrapper owns
platform display normalization, German locale, safe-area handling, and native
presentation. A deliberately segmented onboarding question may use the shared
selection-sheet pattern when a feature ADR explicitly requires separate fields;
the current birth-date exception is recorded in
[`auth/adr/0002-onboarding-e2e-launch-flow.md`](../auth/adr/0002-onboarding-e2e-launch-flow.md).

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
text, and `text-white` for white text on dark surfaces or the existing
primary-interactive gradient. The solid system cyan selection surface is the
documented exception: its content uses `onPrimary` (`#1A1A1A`) in both themes.
That pairing has a 7.85:1 contrast ratio on `#00BAFF`; white has only 2.22:1.
Use `onPrimary` for solid selected pills, tabs, their checkmarks, and equivalent
compact controls. Do not reuse `surface` or theme-dependent primary text as an
implicit foreground token.

Typography uses Poppins only. Body text is Regular; headings, buttons, selected
tabs, labels that need emphasis, and other highlighted text use SemiBold.
Large numeric counters use `display-counter` 60/68. The supported content
hierarchy is `heading-1` 32/48, `heading-2` 24/36, `body-1` 20/30, `body-2`
16/24, `body-3` 14/21, `body-4` 12/18, and `body-5` 10/15, all with 0px letter
spacing. Top-level page-intro groups use 12px between their heading and
supporting copy. Compact navigation chrome, dense data rows, and headings inside
cards may keep tighter spacing when the elements form one local unit.
Semantic headings must go through the shared `Text` primitive with a heading
variant or `accessibilityRole="header"`; the primitive owns the documented
large-title scaling curve. Do not reproduce `maxFontSizeMultiplier` values in
individual screens. Non-heading text keeps unrestricted system scaling.

Light-mode pill buttons have exactly two visual appearances: the light-mode
gradient button and the black button using the primary text color `#1A1A1A`.
There are no white pill buttons in the current light-mode design system. Both
appearances are 56px tall with a 44px radius and a 0.3px inside stroke: gradient
buttons use the vertical light-mode gradient `#00A0E6` top to `#4FD8FF` bottom
with a white stroke, and black buttons use the light border token `#DCE6EE`.
Production screens use the shared `Button` and `BackButton` components for
these actions. A screen-local clone is not an allowed visual variant; add a
shared variant and update this context if a new interaction contract is truly
needed.

The trial-activation and expired-trial payment flow are deliberate full-bleed
branded exceptions. The expired-trial flow separates payer selection from
subscription completion into two routes. Both use the shared
`primaryInteractive` gradient as the view's only gradient, white text on the
saturated outer surface, and
theme-independent light surfaces for content that needs primary and secondary
text. Payer choices stay on the first route; they never expand subscription
details in place, and the subscription route does not repeat the chosen payer
as a summary row. On the subscription route, plan choices use a translucent
white surface with a thin border, restrained inset highlight, and shadow, while
their text stays dark in every app theme. The selected plan uses a dark outline
and checked indicator instead of a tinted fill. The annual plan emphasizes its
monthly equivalent and keeps the annual charge in the description. The
subscription header pairs its back action with the current two-step progress in
one compact row instead of isolating navigation above the page title. Secondary
actions use `systemSubtle`,
payment details use `surface` with a primary-accent border, the subscription
checkout action uses the standard black treatment, and purchase restoration is
an underlined white link. The parent-payment checkout link continues to use
`primaryStrong`. Reusing shared semantic values keeps both ends of the trial flow
synchronized with future Dayova color changes. This treatment is limited to
focused access-setup moments and is not a third general-purpose light-mode
button appearance. The trial-activation screen may use its white primary button
for legible contrast on that saturated surface; this does not introduce a
reusable third button appearance. The expired-trial screen passes the fixed
shared light tokens through the native style API because the tracked Fabric
variable-invalidation issue can otherwise leave newly mounted descendants with
mixed light and dark tokens.

The post-purchase confirmation route extends this focused access-flow exception:
it uses the same `primaryInteractive` gradient and fixed light surfaces, then
offers one forward-only action into the app. Show it after a newly completed
purchase, not after restoring an existing subscription, so the celebration
acknowledges a real transition without becoming recurring friction.

## Product-surface previews

Onboarding artwork or other explanatory UI that depicts a live Dayova product
surface must render the same shared presentation module through an explicit
screen/artwork contract. Do not recreate the product card, upload surface,
copy, tokens, or status/progress layout as a parallel component or static
mockup. Artwork mode stays decorative, non-interactive, accessibility-hidden,
and bounded to its artboard; the surrounding screen owns the accessible
explanation. A deliberate divergence requires a superseding decision with the
learner reason, alternatives, trade-off, reversal condition, and fresh native
evidence. See
[ADR: Render Onboarding Product Previews Through Shared Product Modules](adr/onboarding-artwork-rendering.md).

The current app corner system is: info/small boxes use 24px, 345px-wide
rectangles and card-like surfaces use 32px, and buttons use 44px. Device frame
radii are not app tokens because they depend on the phone/mockup. When nesting
rounded surfaces, the outer radius equals the inner radius plus the padding
between them.

Dark-mode tokens live in `src/global.css`; native/runtime color mirrors derived
from those tokens live in `src/lib/theme-variables.ts`; and theme orchestration
lives in `src/lib/theme.ts`. Theme preference handling lives in
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
