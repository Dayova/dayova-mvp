# Payment footer and shared selection controls

## Decision brief

Learners should recognize a selected answer, plan, weekday, or option consistently,
without text shifting under their finger. The reported production Android footer
also placed Support below the neighboring legal labels. The same defect was
reproduced on native iOS.

Extract the proven motion from PR #586 into one controlled `SelectionControl`.
Keep a fixed hit area and indicator slot, commit selection immediately, and use
radio/checkbox accessibility state. Cards, pills, and the existing branded payment
surface compose the same motion; payment keeps its deliberate light glass/dark
indicator contrast. A global visual restyle or animating decorative success icons
would obscure their distinct meaning. Revisit the appearances only if the
canonical design decision changes; consumers should not fork animation code.

The implementation covers answers, payment plans, SelectSheet options, exam types,
onboarding study/recovery choices, learning-time weekdays, timetable weekdays, and
theme preference. See the design-system context for the reusable contract.

## Reproduction and evidence

Native fixtures render the actual changed subscription screen and selection
components. Only navigation, authentication, store plans, diagnostics, external
URLs, and the theme source are replaced with local deterministic boundaries.
The gallery composes the real ChoiceList, ExamTypePicker, SelectSheet and weekday
editors; its three checkbox pills exercise the shared component directly.
There are no production account changes or store purchases in this verification.

Targets: iPhone 17 Pro simulator (iOS 26.5, 402pt wide), and DAY_169_Pixel_9
Android emulator (API 36, 360dp wide). Existing dev binaries use RN 0.86.0,
Reanimated 4.5.0 and Worklets 0.10.0; the isolated fixture uses those matching
runtime dependencies. The branch itself retains the current lockfile (RN 0.86.3,
Reanimated 4.5.1, Worklets 0.10.1), and automated tests use that lockfile.
This is native component verification, not a rebuilt release or store E2E test.

- `ios-before.png`: original footer; Support is visibly below the neighboring text.
- `ios-after.png`, `android-after.png`: common 48dp minimum target and centered text.
- `ios-choices-light.png`, `android-choices-light.png`: native shared cards/pills.
- `ios-choices-dark.png`, `ios-choices-large.png`, `android-choices-large-dark.png`: dark appearance and enlarged text (iOS accessibility-medium, Android font scale 2). Long answer text wraps inside its card; indicators keep their slots.
- `ios-payment.mp4`, `android-payment.mp4`: repeated native plan changes.

Run `swift assert-footer.swift <screenshot>` on macOS. Vision checks actual rendered
text centers (native Pressable bounds alone failed to detect the original issue).
Before iOS: **47.64px**, fails the 6px threshold. After iOS: **1.91px**, passes.
After Android: **0.00px**, passes. This assertion is for links sharing a row;
large-text layouts may legitimately wrap to separate rows.

## Motion inspection

The inspect-video-evidence skill sampled the complete exported clips. Coverage is
recorded verbatim in the adjacent `*-video-coverage.txt` files. There is no audio
stream to transcribe. Android: monthly at 0s, annual by 1.5s, monthly by 4s,
annual by 5.5s. iOS excerpt: monthly at 0s, annual by 0.5s, monthly by 1.5s,
annual by 3s. Text and card geometry remain stable across the settled choices.
Android's focused 4.8–5.4s sample shows the fading indicator; sampled/emulator
video does not establish exact frame cadence. The 90/180/240ms values are verified
from the shared implementation, not inferred from video. The original iOS capture
included recorder/driver startup and was inspected across its full timeline before
exporting the interaction excerpt.

## Automated validation and review

- `pnpm check`: passed (Biome, ESLint, TypeScript).
- `pnpm test:ui`: 66 suites, 285 tests passed.
- `pnpm test:unit`: 118 Vitest files, 764 tests passed; all Node tooling suites passed.
- Shared-control tests cover immediate exclusive selection, independent checkboxes,
  rapid changes, canceled presses, disabled changes, fixed outer hit areas, and
  reduced motion for all three appearances. They test behavior, not native physics.
- Footer interaction tests exercise Support and each legal destination.
- Changed-file formatting and repository-wide Tailwind class order: passed.
- Full `pnpm format:check` finds three existing unrelated baseline files:
  `scripts/publish-production-ota.mjs`, `src/components/ui/dayova-sheet-frame.tsx`,
  `src/features/learning-plans/use-prepare-session-content.ui.test.tsx`.
- Standards review: no findings. Spec review: removed added horizontal padding
  from timetable weekday pills to preserve their enlarged-text width; its three
  UI tests passed again after the correction.
