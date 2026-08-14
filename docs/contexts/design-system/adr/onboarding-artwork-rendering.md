# ADR: Render Editable Onboarding Artwork As Maintainable Components

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

The upload illustration has a related but different requirement. Its route,
document nodes, copy, and colors must remain theme-aware and responsive to large
system text. A static export would hide those semantics and cannot counter-scale
the embedded labels when the surrounding layout grows.

The path illustration remains static artwork and does not have either failure
mode. This decision therefore applies only to the editable task and upload
illustrations; it is not a blanket SVG ban.

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

Implement the upload illustration behind the equally small
`IntroUploadArtwork({ width, height })` interface as a maintainable TSX module
using `react-native-svg`.

- Keep paths, document nodes, and labels local to the illustration instead of
  leaking SVG details into the onboarding screen.
- Resolve semantic colors at runtime so the same composition has intentional
  light and dark variants.
- Counter-scale the embedded text for large system-font settings so the artwork
  remains readable without destroying its composition.
- Hide the composed illustration from the accessibility tree because the
  onboarding heading and description communicate its meaning.

## Why Not Repair The SVG?

A clean, static SVG is still preferred for complex vector-only artwork.
Repairing the task export would preserve the same underlying problem: important
product copy and the logo implementation would remain opaque generated data.
Re-exporting either editable illustration could fix today's pixels, but a future
wording, theme, or token change would again require Figma and another generated
asset instead of a normal code review.

Both modules create the same useful seam: the onboarding flow only supplies a
width and height, while copy, tokens, composition, and scaling remain local to
the artwork implementation. React Native primitives are appropriate for the
card-like task composition; `react-native-svg` is appropriate for the upload
composition's connected vector route and document nodes.

## Consequences

- Product copy, icons, and semantic styling are now searchable and reviewable.
- The artwork can be regression-tested without parsing generated SVG paths.
- Exact Figma artboard geometry remains coordinate-based and still needs visual
  verification on representative device sizes.
- Maintainable TSX artwork is more verbose than importing one SVG, so it should
  be chosen only when artwork contains maintainable UI content, needs runtime
  theming or accessibility-responsive behavior, or has a broken export,
  following the matrix in `docs/styling.md`.
