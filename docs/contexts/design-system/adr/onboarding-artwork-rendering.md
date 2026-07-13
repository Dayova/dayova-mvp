# ADR: Render Editable Onboarding Artwork As Native UI

- Status: Accepted
- Date: 2026-07-13

## Context

The first onboarding illustration combines a task list, a streak card, and a
learning reminder. Its Figma SVG export was not a reliable source asset:

- all task copy had been converted into generated vector paths and repeated the
  same placeholder text;
- the Dayova mark was an embedded JPEG clipped into a circle, which rendered as
  small fragments around the circle edge;
- colors, icons, and copy were hidden inside generated SVG data instead of using
  the app's design-system tokens and shared modules.

The other onboarding SVGs remain static artwork and do not have this failure
mode. This decision therefore applies to the editable first illustration; it is
not a blanket SVG ban.

## Decision

Implement the first illustration behind the small
`IntroTasksArtwork({ width, height })` interface as a React Native module.

- Use NativeWind for static layout primitives, semantic colors, typography,
  borders, radii, and shadows.
- Keep RN `style` limited to runtime viewport scaling, the fixed 356x242 Figma
  artboard coordinates/transforms, and third-party native components such as
  `expo-linear-gradient` that require a style prop.
- Render the real transparent `dayova-y.png` mark through `Image`.
- Keep the three task examples as readable source text with regression coverage.
- Hide the composed illustration from the accessibility tree because it is
  decorative; the onboarding heading communicates the actual screen purpose.
- Remove the superseded broken SVG after verifying that it has no remaining
  consumers.

## Why Not Repair The SVG?

A clean, static SVG is still preferred for complex vector-only artwork. Repairing
this export would preserve the same underlying problem: important product copy
and the logo implementation would remain opaque generated data. Re-exporting
could fix today's pixels, but a future wording or token change would again
require Figma and another generated asset instead of a normal code review.

The native module creates a useful seam: the onboarding flow only supplies a
width and height, while the copy, tokens, logo, composition, and scaling remain
local to the artwork implementation.

## Consequences

- Product copy, icons, and semantic styling are now searchable and reviewable.
- The artwork can be regression-tested without parsing generated SVG paths.
- Exact Figma artboard geometry remains coordinate-based and still needs visual
  verification on representative device sizes.
- Native implementation is more verbose than importing one SVG, so it should be
  chosen only when artwork contains maintainable UI content or a broken export,
  following the matrix in `docs/styling.md`.
