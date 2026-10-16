# Learning-plan creation header validation

For the 16 October Android/app-wide navigation-control follow-up, see
[DAY-523 capture notes, comparisons and recordings](android-2026-10-16/README.md).
The iOS captures and validation notes below describe the original 14 October
implementation; they are retained as historical evidence.

Captured on 14 October 2026 in the iPhone 17 Pro simulator, iOS 26.5,
dark appearance, 1206 × 2622 pixels. Updated UI: commit `cbaf534a`.
The PNGs are unmodified simulator captures.

| Before: exam date | After: subject selection |
| --- | --- |
| ![Original header with title and percentage](before-exam-date.png) | ![Updated header with back, centered progress, and close](after-subject-selection.png) |

The screens show different steps of the same creation flow. Compare the shared
header layout, not the step content or progress value. The before capture was
taken at 23:26 CEST before reloading the updated app; the after capture was taken
at 23:32 CEST with the updated app.

The after image confirms that the back and close controls flank a centered
progress bar, with no visible header title or percentage. Screen content retains
its own heading. The floating gear is the Expo development tools control.

These still images establish visual layout only. The implementation's 38
passing targeted tests cover progress, back/close dispatch, disabled close,
exam exit, return to a saved exam, and draft pause behavior. Native close
navigation was not confirmed because simulator automation was unreliable.

## Native Liquid Glass follow-up

![Native Liquid Glass back and close buttons](after-liquid-glass-exam-type.png)

Captured at 23:37 CEST on the same iPhone 17 Pro / iOS 26.5 simulator after
relaunching the development app. This records the initial Liquid Glass appearance;
`after-subject-selection.png` records the earlier layout before the glass request.
Both controls are Expo UI native SwiftUI Buttons with `buttonStyle("glass")`,
circular borders, and Dayova's existing icons. The effect is subtle against the
uniform dark background. Older iOS uses native bordered buttons; Android/web
keep the existing shared controls. No blur imitation or new dependency is used.

The screenshot verifies native rendering, icon visibility, spacing, and absence
of header text. Automated coverage exercises native-boundary callbacks and the
disabled close state; manual native interaction remains unverified because the
simulator control service did not reliably target the active window.

## Matched header heights

![Progress bar close in height to the native glass buttons](after-matched-height-exam-type.png)

Captured at 23:42 CEST on 14 October 2026 on the same iPhone 17 Pro / iOS 26.5
simulator. This superseded iteration used a progress bar 40pt tall
beside 48pt button hosts. The three elements share a vertical center, with a
small height difference. Button tap areas and native glass styling are retained.
The override applies only to the learning-plan creation header.

This spacing-only adjustment passed targeted Biome/ESLint and diff checks, and
was visually verified in the simulator. The earlier 38-test behavior validation
is unchanged; no behavior or test assertions changed in this adjustment.

## Compact progress bar (current)

![Compact 16pt progress bar with native glass controls](after-compact-progress-exam-type.png)

The 40pt iteration above was rejected as too large. The current creation header
uses a 16pt bar, centered beside the existing native glass buttons. Button sizes
and tap areas are unchanged. This screenshot is an unmodified iPhone 17 Pro /
iOS 26.5 dark-appearance capture from 14 October 2026.

The size-only change passed targeted Biome/ESLint and diff checks. The screenshot
confirms the compact proportions; previous behavior test results remain
applicable because this change only changes the bar's height utility.
