# ADR: Render Onboarding Product Previews Through Shared Product Modules

- Status: Accepted
- Date: 2026-08-14
- Amended: 2026-10-03 (four intro pages with editorial start graphic and native phone previews)
- Supersedes: the 2026-07-13 decision to maintain three onboarding-only
  illustration implementations

## Context

The onboarding intro pages explain Dayova through previews of learning
steps, material upload, and a generated learning plan. Those previews had become
independent illustrations: a bespoke task/streak/reminder composition, a custom
upload SVG, and a static path SVG. The real product screens changed while the
illustrations did not, so onboarding showed a visual language and behavior that
learners would not encounter after account creation.

The problem was not an inaccurate token or one stale label. The architecture
allowed two sources of truth for the same product concept. Updating screenshots,
Figma exports, or onboarding-only components could repair the current pixels but
would not prevent the next drift.

## Decision

Onboarding product previews use the same presentation modules as the current
product surfaces:

- the calendar intro renders `CalendarWeekdays`, `WeekCalendar`, and two
  `DashboardAgendaEntryCard` presentations from the live dashboard;
- the material preview renders `MaterialUploadStepLead` and
  `MaterialUploadActionCard` from `learning-plan-setup-steps.tsx`;
- the final intro preview and the real plan-detail screen both render
  `LearningPathVisual` from `learning-path-visual.tsx`.

Each shared module has an explicit screen/artwork contract. Screen mode keeps
the real action, accessibility label, dynamic-type behavior, and responsive
layout. Artwork mode renders the same visual content as a non-interactive,
accessibility-hidden preview with bounded text scaling so it remains inside the
fixed onboarding artboard. No onboarding wrapper supplies a no-op press handler
or exposes a dead control.

`NotchedActionCard` therefore includes a typed `pressType="none"` presentation
mode. It renders the shared card and action affordance without creating a
`Pressable`. The screen modes remain unchanged and interactive.

The small onboarding wrappers own only preview data, available artwork
dimensions, and arrangement. They do not duplicate card or path structure,
typography, semantic colors, upload copy, learning-path geometry, node icons,
or state rules. The superseded static `intro-path.svg` and copied product-card
implementations remain removed.

The first intro's learner job is to make starting feel manageable. It uses
three large editorial pills: starting today, making 30 minutes for one's goal,
and progressing step by step. These describe the promise; they are not a fake
streak, metric, or dashboard interface. The user rejected the dashboard-card
composition as the opening graphic and explicitly requested this direction.

The three feature explanations use a shared decorative `IntroPhoneFrame`
inspired by the provided light/dark device reference. The frame owns device
chrome (soft top corners, white/black screen, subtle camera island and a
diagonal fade into the page, without a bottom bezel) and uniform scaling,
while the screen content uses real presentation
modules. The calendar shows a real week with two example events. The upload
preview shows the actual upload lead and card without the former extra panel.
The learning path includes the shared adaptive continuation and exam card.

This trades some embedded text size for recognizable product context. Short
accessible copy outside the device explains each page. Reconsider the frame
if its scaling prevents recognition of the relevant feature; do not replace
shared product modules with copied screenshot UIs. Native evidence is in
`docs/evidence/onboarding-intro/`; the README records the preview scope.

The final intro's learner job is to understand that Dayova turns material into
an ordered route, not to inspect the metadata of a single plan. Its artwork mode
therefore composes a bounded excerpt of the real path: one completed node, the
current selected node, and one adaptive locked node, the dashed continuation, and the blue exam card. This uses the same
connector geometry, pucks, icons, colors, and completed/current/locked rules as
the live screen. Artwork mode is deliberately motion-free and renders Views,
not dead Pressables; screen mode retains reduced-motion-aware breathing,
selection, accessibility labels, and open/select behavior.

For the final intro, reusing `LearningPlanCardVisual` prevented code drift but
communicated plan metadata and a next step instead of order and progression.
Restoring the old #458 static path matched the desired composition more closely,
but recreated a second source of truth for geometry, icons, tokens, and state
semantics.

## Guardrail

A product-surface change that alters one of these shared modules changes its
onboarding preview in the same code path. If a future intro needs a deliberately
different representation, that divergence requires a new or superseding
decision record with the learner reason, alternative, trade-off, reversal
condition, and native evidence. Reintroducing a copied product card or static
mockup is not an acceptable shortcut.

The onboarding wrappers remain decorative. The surrounding intro heading and
description communicate meaning to assistive technology; embedded preview text
is not a second reading path.

## Consequences

- Product and onboarding no longer maintain parallel card/upload UIs.
- Copy, tokens, icons, and structure stay searchable and regression-testable.
- The shared modules have a slightly wider API because they support a bounded
  decorative context as well as the live product screen.
- Dashboard overview cards now form one presentation module with explicit
  screen/artwork modes; onboarding changes their composition, not their product
  structure.
- The Learning Path geometry moved out of its route into a feature presentation
  module. This gives both contexts one seam, at the cost of a discriminated
  screen/artwork interface.
- A product redesign can still require onboarding artboard adjustments, but it
  cannot silently leave onboarding on the former product UI.
- Every affected intro page needs fresh native light/dark evidence because the
  previous screenshots prove the superseded illustrations, not this decision.

## Reversal condition

Reconsider the first intro composition if the dashboard no longer expresses
the start promise represented by the editorial pills.
Reconsider the final intro if the live product no longer uses an ordered
Learning Path, or if its learner job changes from explaining sequence and
adaptation. A future replacement must still share its product presentation
module and must include fresh native evidence; a copied card, Figma export, or
onboarding-only SVG is not a valid reversal.

The intro device uses a wider 460 × 550 illustration artboard and the full
available artwork width. This gives embedded product content more horizontal
room while preserving uniform scaling, the page copy, and the primary action.
