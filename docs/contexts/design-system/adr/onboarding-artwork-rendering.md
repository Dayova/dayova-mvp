# ADR: Render Onboarding Product Previews Through Shared Product Modules

- Status: Accepted
- Date: 2026-08-14
- Amended: 2026-08-31 (first intro restores the layered daily-guidance composition through shared dashboard cards)
- Supersedes: the 2026-07-13 decision to maintain three onboarding-only
  illustration implementations

## Context

The three onboarding intro pages explain Dayova through previews of learning
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

- the first intro and the live dashboard both render the agenda-entry,
  weekly-progress, and next-learning-step presentations from
  `dashboard-product-cards.tsx`;
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

The three small onboarding wrappers own only preview data, available artwork
dimensions, and arrangement. They do not duplicate card or path structure,
typography, semantic colors, upload copy, learning-path geometry, node icons,
or state rules. The superseded static `intro-path.svg` and copied product-card
implementations remain removed.

The first intro's learner job is to show how Dayova turns scattered daily work
into one clear next action. It therefore restores the stronger spatial grammar
from the earlier Figma composition: an agenda item and weekly progress sit
behind one dominant next-learning-step card. The onboarding wrapper owns only
their overlap, rotation, scale, and shadow. The three cards themselves keep a
typed screen/artwork contract in the shared dashboard module, so live mode
remains interactive and accessibility-responsive while artwork mode is
motion-free, bounded, and hidden from the accessibility tree.

The final intro's learner job is to understand that Dayova turns material into
an ordered route, not to inspect the metadata of a single plan. Its artwork mode
therefore composes a bounded excerpt of the real path: one completed node, the
current selected node, and one adaptive locked node. This uses the same
connector geometry, pucks, icons, colors, and completed/current/locked rules as
the live screen. Artwork mode is deliberately motion-free and renders Views,
not dead Pressables; screen mode retains reduced-motion-aware breathing,
selection, accessibility labels, and open/select behavior.

For the first intro, we rejected both the three-equal-`SessionCard` stack and a
literal restoration of the old #458 custom task/streak/reminder cards. The
equal stack was accurate but repetitive and read as a schedule instead of a
product promise. The copied Figma cards had the stronger hierarchy but would
again drift from the dashboard. Sharing the current dashboard presentations
keeps the hierarchy without restoring a parallel UI implementation.

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
agenda, weekly progress, and next action as the core daily-guidance model.
Reconsider the final intro if the live product no longer uses an ordered
Learning Path, or if its learner job changes from explaining sequence and
adaptation. A future replacement must still share its product presentation
module and must include fresh native evidence; a copied card, Figma export, or
onboarding-only SVG is not a valid reversal.
