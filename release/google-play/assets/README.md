# Google Play asset manifest

Prepared: 2026-08-22

## Ready assets

| File | Validated properties | Intended Console slot |
| --- | --- | --- |
| `play-store-icon-512.png` | 512 × 512 PNG, RGBA, 66,136 bytes | Play Store app icon |
| `feature-graphic-1024x500.png` | 1024 × 500 PNG, 24-bit RGB/no alpha, 628,561 bytes | Feature graphic |
| `feature-graphic-source.png` | 1774 × 887 PNG, 24-bit RGB, 1,331,531 bytes | Retained generation source; do not upload instead of the exact-size file |

The icon was resized from the repository's official Dayova app mark. The
feature graphic was AI-generated from the same brand mark, then cropped/resized
and converted to the Play-safe RGB PNG above. Visual inspection found a clean
white/pale-blue composition with the Dayova Y, a learning path, checks, a
calendar, and books; it contains no promotional text, price, rating, device
frame, or store badge.

Generation brief preserved for provenance:

> Create a polished Google Play feature graphic for Dayova, a calm German
> learning-planner app. Use the provided official Dayova Y mark faithfully as
> the dominant brand element. Make a wide 2:1 composition on a white and very
> pale icy-blue background, with a subtle flowing learning path and restrained
> educational symbols such as check marks, a calendar, and books. Keep it
> premium, spacious, friendly, and crisp. No words, letters beyond the logo,
> slogans, prices, ratings, device mockups, app-store badges, or gradients that
> reduce legibility. Output a clean raster suitable for cropping to 1024 × 500.

The generated source itself is retained so the exact visible result—not prompt
text alone—is the authoritative provenance artifact.

## Screenshots — still required

Google Play requires at least two phone screenshots. Capture four portrait
screens from the exact Play internal-test release candidate, using synthetic
data and no personal information:

1. **Home / next step** — upcoming exam and next learning action.
2. **Personal learning plan** — a populated plan with dated sessions.
3. **Focused learning session or analysis** — a representative question,
   feedback, or progress view without unverifiable claims.
4. **Settings / trust** — support, privacy, subscription management, and the
   completed account-deletion entry.

Use a modern Android phone resolution and keep the same device, locale (de-DE),
time, and synthetic account across the set. Screenshots must show the app UI,
not a developer menu, browser, iPhone frame, or generated mock interface.

The current emulator attempt was rejected as screenshot evidence because its
installed development client had a native/JavaScript Worklets mismatch
(0.8.3/0.10.0) and rendered a blank screen. The Dayova website repo was also
inspected; its product images are older iPhone-framed marketing compositions,
so they are useful brand references but not valid current Android screenshots.

## Final asset QA

- [x] App icon is exactly 512 × 512 PNG.
- [x] Feature graphic is exactly 1024 × 500 and has no alpha channel.
- [x] Artwork uses the official brand mark and no unsupported marketing claim.
- [ ] Screenshots come from the approved current Play internal-test build.
- [ ] At least two screenshots are uploaded; four are recommended above.
- [ ] Store listing and screenshots accurately match every shipping feature.
