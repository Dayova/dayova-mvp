# ADR: Render Onboarding Product Previews Through Shared Product Modules

- Status: Accepted
- Date: 2026-08-14
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

- learning-step previews render `SessionCard` from `learning-plan-ui.tsx`;
- the material preview renders `MaterialUploadStepLead` and
  `MaterialUploadActionCard` from `learning-plan-setup-steps.tsx`;
- the plan preview and the real plan overview both render
  `LearningPlanCardVisual`.

Each shared module has an explicit screen/artwork contract. Screen mode keeps
the real action, accessibility label, dynamic-type behavior, and responsive
layout. Artwork mode renders the same visual content as a non-interactive,
accessibility-hidden preview with bounded text scaling so it remains inside the
fixed onboarding artboard. No onboarding wrapper supplies a no-op press handler
or exposes a dead control.

`NotchedActionCard` therefore includes a typed `pressType="none"` presentation
mode. It renders the shared card and action affordance without creating a
`Pressable`. The screen modes remain unchanged and interactive.

The three small onboarding wrappers own only preview data, artboard dimensions,
scaling, and arrangement. They do not duplicate card structure, typography,
semantic colors, upload copy, or learning-plan status/progress layout. The
superseded static `intro-path.svg` and custom upload/task compositions are
removed.

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
- A product redesign can still require onboarding artboard adjustments, but it
  cannot silently leave onboarding on the former product UI.
- Every affected intro page needs fresh native light/dark evidence because the
  previous screenshots prove the superseded illustrations, not this decision.
