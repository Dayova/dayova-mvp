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

`SearchField` in `src/components/ui/search-field.tsx` composes the existing
`FieldControl` and `Input` with a decorative Hugeicons search glyph. It retains
native input props, system text scaling and a named accessibility label. In
exam-topic setup, search results use reversible `SelectionControl` checkboxes.
Selected topics and hints use one horizontally scrollable row of removable chips
with named remove actions and minimum 44pt targets. Newly appended choices slide
into view after layout; reduced motion reveals them without animation. Removal
and resizing do not force a scroll. Long chip labels wrap within the row width
so the full text and remove action remain reachable. The entered nonblank title is immediately
selectable below the input using the same checkbox row, merging exact catalog
matches without duplicate choices. The subsequent hint page uses the same search and removable-choice pattern,
with six topic-ranked suggestions and a quiet “Weitere Hinweise” action.
Existing hint lines remain removable; custom text can be added through search.
Changing topics never changes the selected hints. See the
[topic-input contract](../product/adr/inline-topic-search-with-free-scope.md).

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
presentation. Dedicated date steps with a persistent calendar use `InlineDatePicker`
from `src/components/ui/inline-date-picker` instead. It owns native inline
rendering, theme, native sizing, and Android date-only timezone conversion.
[DAY-515](https://linear.app/dayova/issue/DAY-515) defines the exam-date step: the
calendar appears below the question, without a separate selected-date card. Day
changes immediately update the Continue label on iOS ("Weiter mit 2. November 2026").
Android uses "Weiter" because its native Material calendar already displays the
selected date prominently above the calendar grid.
The creation progress header stays visible, and Continue advances to topics.

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

Exam/subject, answer and other branded selections use the same vertical
`primaryInteractive` gradient (`#00A0E6` → `#4FD8FF`) as primary buttons.
The `selection` token aliases that gradient. Selected letters, checkmarks and
pill labels use fixed `onPrimary` for readable contrast in both themes.
Card text remains theme text, with an accent fill and cyan border. Shared
`SelectionControl` owns press feedback, interruptible transitions, radio/checkbox
semantics and reduced motion; screens own immediate selected state. See the
[selection decision](adr/answer-selection-colors.md).

`useSelectionMotion` is the single motion contract for these controls and the
subscription plan cards: 90ms press compression to 0.98, a 180ms selection
transition, and a 240ms spring for the check and release. Animate presentation
inside a stationary native touch target; commit selection only from `onPress`.
Reduced motion assigns final values directly. The subscription cards retain
their documented fixed-light glass surface, dark selected outline, and white
check on a dark indicator. They share the interaction curve, reflow at larger
text sizes, and disable selection while Store plans load or a purchase runs.
Single-choice weekday and plan lists expose a radio group; independently
toggleable learning days retain checkbox semantics.

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

Custom `ScreenHeader` titles remain complete. The shared header measures its
side controls and keeps a centered inline title when it fits. A native text
wrap, enlarged text, or compact viewport moves ordinary titles below the controls
into a full-width row. A compound title may supply two complete parts: it keeps
those parts beside Back when they fit, wrapping only at their boundary with a
discretionary hyphen that is visible only when the word breaks. If a part
fragments or a timer needs the space, the header gives the two complete parts
their own full-width row. Wissenscheck supplies “Wissens”
and “check”; its accessible label remains the uninterrupted word.
`titleClassName` customizes typography; the shared header owns side padding. Learning-session headers use the shared content-size padding
and reserve timer space only when the timer is present. The session's question
and action areas share that padding; action pairs stack at enlarged/compact
sizes so the expanded header does not leave task content unreachable. See
[DAY-513](https://linear.app/dayova/issue/DAY-513).

Learning-session actions stay pinned while their measured height uses at most
40% of the available question area. Larger actions join the vertical content
scroll; iOS keyboard height is deducted from that budget, and pinned actions
measure their screen position below the header. On Android, actions always join
the content scroll while the keyboard is visible, following the shared keyboard
contract rather than relying on window resizing. Written questions and
multiple-choice answers both remain scrollable. At compact/enlarged sizes, choice
letters and selection indicators sit above the full-width answer text. Long
German session-action labels have optional soft-hyphen breaks and centered
wrapping, with unchanged accessible names and unrestricted system text scaling.

Primary and neutral pill actions use the shared gradient and neutral Button
appearances. Ordinary buttons have a 56pt minimum height and a 44pt radius;
content may grow with system text size. Primary actions keep their existing
vertical gradient and white label. Cancel and destructive actions follow the
shared popup rule below; screen-local copies are not permitted.

### General popup and destructive-action rule

The [canonical popup decision](https://app.notion.com/p/3fd2e87228bf81588539c6e23c17abfe)
records the rationale; [DAY-501](https://linear.app/dayova/issue/DAY-501) tracks
the implementation contract. **Decision owner: Jakob Rössner, 18 October 2026.**
After reviewing Apple HIG, Material 3 and native-app examples, Jakob chose compact
headers for normal text, with content-aware reflow for enlarged text and narrow
widths. This supersedes #727/DAY-501's unconditional separate close row; it
retains #729’s shared cancel/danger refinement and the existing
personal-subject/learning-time action treatment. Design approval authorizes the
implementation; PR #841 still requires Jakob's final visual review before merge.
This supersedes the earlier neutral destructive alias and the earlier full-red
confirmation/white-label direction for app-owned popup actions.

- **Job and hierarchy:** let the learner understand one decision, its consequence,
  and the available action. Title first in the reading/focus order, explanation
  second, actions last; retain the independent close control.
- **Structure:** every app-owned popup uses `DayovaSheetFrame`, directly or via
  `ActionSheet`, `SelectSheet`, `ConfirmationSheet`. Keep the grey drag handle.
  Title and the 48pt close control share a row with a 16pt gap. One- and two-line
  titles stay beside close; native text wrapping beyond two lines gives the title
  full width below close, with a 12pt gap. The fit resets when title, available
  width, font scale or close visibility changes. Short titles can remain compact
  even at large text sizes; important text is never truncated or shrunk to fit.
  Supporting copy follows at 12pt; content at 24pt.
  Hidden/non-dismissible close controls do not reserve an empty row. Existing
  content sizing, scrolling, focus, keyboard, and safe-area behavior remain.
- **Delete/remove actions:** use shared `Button variant="destructive"`: 1pt
  `danger-action` outline, `danger-subtle` fill, and `danger-action` label/spinner
  in both themes. The existing `destructive-outline` name is a compatible alias
  for the same subject-list appearance. Omit decorative icons from text delete
  buttons. Preserve explicit verbs and all confirmation/reverification guards.
- **Cancel:** use `variant="cancel"`, a card-colored fill, border token outline,
  and primary text. Confirmation dialogs always use it; callers cannot opt back
  into a black cancel action. Primary save/continue actions remain primary.
- **Sizing:** normal confirmation pairs place Cancel left and Confirm right,
  equally wide and stretched to the same height, with 12pt between them. Compact
  horizontal padding leaves room for German labels without reducing font size.
  Large text and narrow widths may stack/grow/scroll; never clip action labels.
- **Account choices:** the paywall's “Konto verwalten” sheet uses two text
  buttons, “Konto wechseln” (`cancel`) and “Konto löschen” (`destructive`),
  with the same equal-width popup sizing and large-text stacking. It is a
  short action choice, so it has no settings-card shell, divider, or row icons.
  Switching and the next deletion confirmation wait for native dismissal.
- **States:** preserve busy/disabled/error behavior, accessible action names,
  screen-reader focus and safe dismissal. Error/status colors stay separate.
- **Scope exceptions:** native OS pickers/permission alerts retain platform
  chrome. Compact swipe-trash controls (including the approved #737 learning-plan
  rail) and inline remove icons remain compact controls, not popup text CTAs.
  Ordinary logout/navigation is not automatically destructive. The dashboard
  Today exception below remains scoped.
- **Platform boundary:** app-owned compact sheets share this Dayova header on
  iOS and Android, including their existing swipe/escape/Android Back behavior.
  Do not add an empty toolbar solely to mimic OS chrome. A future full-screen or
  multi-step editor may use a genuine platform navigation/action toolbar; its
  content title is separate from that navigation. Existing native picker chrome
  remains platform-owned. See the primary research links in the canonical record.

**Decision:** centralize this rule in the existing sheet/button primitives. This
removes per-screen visual exceptions and the former `actionAppearance` opt-in;
no new dependency or parallel popup component is needed.

DAY-490's approved Today calendar navigation is a scoped exception: the
`DashboardCalendarHeader` reset-to-today control uses the shared ghost Button
with a bordered card surface and theme text, preserving the approved light
pill without making it a general-purpose CTA variant. See
[the dashboard isolation contract](../../dashboard-main-isolation.md).

Learning-time settings restore the personal-subject management pattern: muted
weekday badges, bordered cards, a visible pencil, and swipe-to-delete with a
text-only rounded action. Its `destructive-outline` appearance introduced in
PR #816 now follows DAY-501's general destructive-action rule above. Screen
readers retain a named delete action on the pencil. See
[the restoration record](https://github.com/Dayova/dayova-mvp/pull/817#issuecomment-6252198402).

The empty timetable uses one full-width gradient import button and a full-width
neutral manual-entry button. File and camera are equal sources inside the shared
`ActionSheet`, following the school-material upload pattern. Use source rows
instead of tiles when content-size layout requires stacking. Native pickers open
after the sheet's `onDismiss`, and the pending selection disables competing
entry actions. The editor keeps reimport subordinate to its existing save action.
This decision introduces no new button appearance; see
[DAY-378](https://linear.app/dayova/issue/DAY-378/clarify-timetable-entry-with-one-import-action-and-a-secondary-manual).

The trial-activation and expired-trial payment flow are deliberate full-bleed
branded exceptions. The expired-trial route presents one Store-only path into
the subscription route; it must not offer payer selection, QR codes, website
checkout links, or other purchase steering. Both routes use the shared
`primaryInteractive` gradient as the view's only gradient, white text on the
saturated outer surface, and theme-independent light surfaces for content that
needs primary and secondary text. On the subscription route, plan choices use a
translucent white surface with a thin border, restrained inset highlight, and
shadow, while their text stays dark in every app theme. The selected plan uses a
dark outline and checked indicator instead of a tinted fill. Prices and billing
periods always come from the native Store: the complete charge is prominent and
an annual monthly equivalent is secondary when the Store provides one. The
subscription checkout action uses the standard black treatment, and purchase
restoration is an underlined white link. Reusing shared semantic values keeps
both ends of the trial flow synchronized with future Dayova color changes. This
treatment is limited to focused access-setup moments and is not a third
general-purpose light-mode button appearance. The trial-activation screen may
use its white primary button for legible contrast on that saturated surface;
this does not introduce a reusable third button appearance. The expired-trial
screen passes the fixed shared light tokens through the native style API because
the tracked Fabric variable-invalidation issue can otherwise leave newly mounted
descendants with mixed light and dark tokens.

The post-purchase confirmation route extends this focused access-flow exception:
it uses the same `primaryInteractive` gradient and fixed light surfaces, then
offers one forward-only action into the app. Show it after a newly completed
purchase, not after restoring an existing subscription, so the celebration
acknowledges a real transition without becoming recurring friction.

The learning-plan material step uses the shared `MaterialUploadGrid`: two
columns of dashed plus tiles, with uploaded materials occupying those same
slots. It starts with four slots and always retains an add tile; every empty
tile opens the existing camera/gallery/files sheet. Large text and compact
viewports use one column. Photos use protected image previews with retry;
PDF/Office files show type, filename and size without simulated page content.
The same grid renders its first row decoratively in the bounded onboarding
phone artwork. See
[DAY-543](https://linear.app/dayova/issue/DAY-543/show-learning-plan-materials-in-a-preview-upload-grid).

## Product-surface previews

### Personal-subject action appearance

Exam-type and subject selection share `SelectionOptionRow`: identical card
geometry, icon treatment, radio checked semantics and a selection-gradient check
indicator with a white (`#FFFFFF`) check, as specified in the
[selection color decision](adr/answer-selection-colors.md). The subject catalog
is one continuous list, without a
separate personal-subject heading. Adding a subject always saves it for reuse;
there is no permanent-versus-one-time choice or extra confirmation step.
Existing built-in/personal matches are reused; timetable-only or legacy one-time
matches are persisted when explicitly added. Legacy selections remain readable
without silently migrating existing entries. The settings pencil opens "Fach
bearbeiten" with save and delete actions. Delete opens the existing confirmation
only after the editor's native dismissal; swipe deletion remains available.

DAY-187 restored the September device-review treatment in personal subjects.
Its cancel and destructive-outline appearances are now the general DAY-501
rule above, replacing the former opt-in API. The palette remains light
`#B01B10` / `#FFF0EE`, dark `hsl(4 100% 75%)` / `hsl(4 55% 16%)`.
See [restoration scope and provenance](https://github.com/Dayova/dayova-mvp/pull/816#issuecomment-6252197350).

Onboarding artwork or other explanatory UI that depicts a live Dayova product
surface must render the same shared presentation module through an explicit
screen/artwork contract. Do not recreate the product card, learning path,
upload surface, copy, tokens, or status/progress layout as a parallel component or static
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

Back and close navigation controls share `NavigationIconButton` through
`BackButton` and `CloseButton`: 48pt circles, card background, semantic border,
and a 20pt theme-text Hugeicon with 2.4 stroke. Both use the shared Button's
pressed, disabled, web-focus and accessibility behavior, with 8pt hit slop.
This includes sheet/modal close controls, password reset and subscription back
navigation. Contextual labels and existing navigation/confirmation behavior
remain with the caller. Content-removal X actions are not navigation controls.
This supersedes the smaller path-2/path-3 close treatment per Jakob's
16 October direction ([DAY-523](https://linear.app/dayova/issue/DAY-523/unify-app-wide-back-and-close-navigation-controls)).

The learning-plan creation header is a scoped exception, per the 14 October
2026 user direction: both back and close use native SwiftUI buttons through
Expo UI, with Apple's `glass` button style on iOS 26+ and `bordered` on older
iOS versions. The native control owns interaction and accessibility, while
Dayova's Hugeicons remain the button content. Android and web retain the shared
BackButton/CloseButton controls, now with matching geometry and appearance.
Keep native glass scoped to the creation header. The creation progress
bar is 16pt tall, centered beside the 48pt button hosts. This keeps the bar
compact while preserving comfortable button tap areas.

Exam type, subject, date, topic and hint pages share `CreationActionFooter`.
The action is a sibling of the scroll content, with 24pt side padding and bottom
padding `max(safeArea.bottom + 10, 24)`. Retain the existing iOS keyboard-sticky
behavior on the other creation steps. On topic and hint pages, remove the entire
footer while the software keyboard is visible and restore it after dismissal,
without resetting search or selections. Topic/hint content scrolls above the
footer when shown; do not place Continue inside a growing result list or a
scroll container.

## Notes

- Use `SupportContact` for contacting the team from Settings, access screens,
  and blocking operational errors. Put the action beside the failure and keep
  existing recovery actions available. Pass a static, user-facing screen name
  as `context`; never pass raw errors, account identifiers, or learning content.
  It opens an editable email draft and provides the address, a native copy/share
  action, and a website fallback in `DayovaSheetFrame`. Keep explicit accessible
  labels on launch controls so returning from another app preserves their names.
  See [DAY-381](https://linear.app/dayova/issue/DAY-381/make-support-easy-to-contact-from-app-failures).
- Capture reusable component and styling decisions here.
- Put design-system ADRs in `docs/contexts/design-system/adr/`.
- Use NativeWind for static app UI. Follow the rendering-choice matrix in
  `docs/styling.md` when deciding between NativeWind, RN geometry styles, SVGs,
  and native artwork modules.

### Duration input

`DurationPickerSheet` is the app-owned adapter for elapsed learning time. It uses
universal Expo UI Picker columns: native hour/minute wheels on iOS, platform
menus on Android/web. It does not interpret durations as clock times, dates or
AM/PM. Learning-plan editors use 5-minute increments from 5 to 240 minutes;
invalid combinations cannot be confirmed. Selection is staged until Übernehmen;
closing discards it. Present it after the editor dismisses and return only after
the duration sheet dismisses. Native picker geometry/theme is owned here; app
screens must not import the platform picker directly.

## Onboarding learning-time controls

The duration selector uses the onboarding appearance of `SnapCarouselSelector`:
a 128-point thin progress ring and a 96-point selected gradient tick, based on
the supplied MVP Login 5 reference. It renders the values supplied by the
existing learning-time model; this design change defines no allowed duration
range and makes no backend, validation, or persistence changes. Duration values
and their compatibility rules belong to PR #813. The ring uses compact min/h
labels, independently of the allowed values. Continue confirms the displayed
initial value; merely opening the page does not save it.

The 5 October 2026 user correction supersedes the darker selected weekday
palette: weekday pills now use the primary-action gradient and `onPrimary`
text through `SelectionControl`, following the
[selection-color ADR](adr/answer-selection-colors.md).
Their accessible checkbox state
is retained; the visual checkmark is omitted. Weekday pills retain the original
48-point minimum height and semibold body-3
type, arranged 2/2/2/1 with wrapping for larger content sizes. Initial answers
are empty; example selections belong only in historical screenshot evidence.

The duration explanation adapts to the chosen value; an additional explanation
between weekdays and start time brings the profile flow to twelve steps.

## In-session feedback motion

Answer evaluations fade in over 220 ms. Only a correct answer receives a small
status-icon scale from 94% to 100%; partial and incorrect answers retain their
existing wording and colors without a success or punitive motion. The rating
is a semantic heading with a polite accessibility live region.
New question content fades in over 180 ms, keyed by item identity so typing or
selection changes do not restart it. Newly expanded theory explanations use
the same short fade. All contents and actions remain available immediately;
there are no exit delays, timed navigation, or additional haptics.
Reduced motion suppresses these entrances. Existing theory-card transitions,
choice feedback, progress animations, and submission success haptics remain
unchanged. See [DAY-509](https://linear.app/dayova/issue/DAY-509).

Theory disclosures also animate their chevron over 180 ms and their section
layout over 200 ms when expanding/collapsing. Reduced motion leaves both static.

## Search selections in exam setup

Topic and hint suggestions reuse `SelectionOptionRow`, the same rounded card used by exam-type and subject selection. Search choices use checkbox semantics for multiple selections; existing subject/exam choices retain radio semantics. The optional leading icon, wrapping label, subject metadata, selected accent surface and indicator are owned by the shared row. `SearchSuggestion` supplies the custom-entry wording and a concise accessible title; it does not clone the visual treatment.

Keep neutral removable `SearchSelectionChip` controls below the input, one question and one search per page, and topics → optional hints → material navigation. Show four catalog topic alternatives and six contextual hints initially. Additional hints are revealed with “Weitere Hinweise”. Preserve disabled semantics and explicit remove labels. Existing hint lines remain removable and custom hints can be added through search. This supersedes DAY-530's earlier transparent plus-row treatment following the user's PR #884 feedback on 18 October 2026. See https://linear.app/dayova/issue/DAY-530 and the [decision record](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a).

## Press feedback

Shared Buttons (including icons and links) and custom actions use
`FeedbackPressable`: 90 ms press compression to 97%, followed by a damped
return. Small/icon Buttons and compact add, close and notification controls use
92% so their compression remains visible on small surfaces. Shared feedback
controls also select 92% automatically for measured surfaces up to 96 × 64 dp;
larger surfaces use 97%, and explicit press scales remain authoritative. Layout
callbacks are forwarded unchanged. The detached notched-card action uses its
visible circle size for the same rule. Short taps complete
the 90 ms compression before springing back; release never cancels the inward
motion prematurely. Disabling, unmounting or reduced motion invalidates pending
animation callbacks. Animation starts in the touch handler so fast taps are not lost to state
batching; action dispatch never waits for animation. Opacity-based controls use
`FeedbackTouchableOpacity`, preserving their existing active opacity.
Coverage includes shared ActionSurface/FieldTrigger/sheets, dashboard cards,
learning-plan cards and theory disclosures, settings, learning times, timetable,
notifications, access screens, and plain authentication/onboarding actions.
Existing active colors, labels, handlers, and caller styles remain intact.
Shared selection rows and pills retain `SelectionControl` as their single press
animation, including in auth, learning-time and timetable flows. Do not wrap
these controls in `FeedbackPressable`.
Calendar selection, learning-path breathing and analytics flips stay on child
views; their outer controls now provide independent press feedback. Native
controls retain system feedback. The notched card's invisible hit target drives
the shared press motion on its visible action circle, keeping the hit area fixed.
Both interactive brand titles also use the shared press control.
Caller transforms take precedence so existing animations are not replaced.
The simple transform runs with React Native Animated's native driver on native
platforms; it adds no dependency and does not migrate existing Reanimated code.
Reduced motion disables scaling, including when the preference changes during
an interaction. Until the preference is available, controls remain static.
Selection rows invoke the existing safe iOS selection haptic only when choosing
an unselected option. Buttons do not add automatic haptics: existing success and
native-control feedback must not be duplicated.

Tracked in [DAY-508](https://linear.app/dayova/issue/DAY-508).

The October 2026 source audit traced interactive call sites across 80 TSX files,
including shared wrappers and dynamic calendar controls. Remaining raw press
controls are the shared feedback and selection implementations and the
notched-card hit target. Native tabs,
switches and pickers retain platform feedback; static onboarding artwork is not
interactive. This is source coverage, not a claim of visual QA on every screen.

## Learning-plan preparation

The preparation screen hides the creation header, including its back/close
controls and overall-flow progress bar, in every preparation stage. Its job is
to explain the ongoing work: flower and heading first, one preparation progress
bar second, and the checklist third. Completion advances automatically; a quiet
ghost action, **Später fortsetzen**, remains in a persistent footer during
processing and errors, outside the scrolling content so it stays reachable at
large text sizes. Two progress bars compete for attention and overload this
waiting surface: the upper bar describes the overall creation flow, while the
remaining bar and checklist describe preparation. Showing both on one waiting
screen adds competing progress contexts without another decision for the learner.
Removing the upper bar and its two navigation buttons reduces visual load and
keeps attention on preparation. Form steps retain their creation header. Without
that header, the preparation screen owns safe-area padding in its scroll view
and footer.
Flower, heading, progress bar, and checklist form one vertically centered group
in the available space above the footer. The scroll content grows to fill that
space but can overflow vertically on small displays or at larger text sizes.

Leaving is not a server-side cancellation or rollback: an already dispatched
analysis action or mutation may still finish and persist its result. The client
stops dispatching subsequent preparation steps and ignores late navigation after
exit. Back/close controls cannot reliably undo that server work; the explicit
**Später fortsetzen** label describes leaving a saved draft without promising
to pause or abort all processing. This is a reason to clarify the exit, not to
trap the learner on the waiting screen.
**Später fortsetzen** returns to Learning Plans with the saved, unaccepted
draft intact; Android system back remains available. Errors also retain retry.
Do not remove this explicit exit on iOS, where the back gesture is disabled.

The temporary creation flow uses one preparation screen for material analysis,
recognized scope, and diagnostic preparation. It skips the separate scope
confirmation screen, automatically applies the recognized scope through the
existing mutation, and continues to review after preparation. Existing scope and
generating links redirect to analysis so saved links remain resumable. To restore
manual confirmation, restore its route and the analysis-to-scope transition
together; the backend confirmation requirement remains in place.

The screen places a compact Dayova flower above a heading, animated shared
`FlowProgressBar`, and a three-step checklist. Visual stages use an estimated
completion time, divided into thirds. The estimate starts at 15 seconds and
adapts to the median of the last five successful full runs in the current app
session (samples bounded to 1–60 seconds). Failed, cancelled, and resumed runs do
not train the estimate. This is a presentation estimate, not measured backend
phase completion or a guaranteed ETA.

Actual readiness always wins: there are no minimum stage durations or completion
holds. If work finishes in eight seconds, navigation starts at eight seconds,
even when a remaining visual stage must be skipped. The final item stays active
if processing exceeds the estimate. Backend requests remain sequential; errors
and cancellation stop visual advancement and subsequent requests. Resumed work
skips completed stages. Errors remain on the screen with a retry action.

Pending items are numbered, the active item shows an indicator, and completed
visual stages use the shared Hugeicons check on cyan with `onPrimary`. Reduced
motion retains static stage indicators.
