# DAY-513 native sizing and compound-title verification — 2026-10-16

Issue: [DAY-513](https://linear.app/dayova/issue/DAY-513). PR: [#880](https://github.com/Dayova/dayova-mvp/pull/880).

## Latest follow-up: visible word-break hyphen

The user now explicitly requests **Wissens- / check**. This supersedes the
hyphen-free preference documented in the earlier run below. Implementation
`569e51d34353538ee0b216d01db66d23a58b1484` adds an explicit hyphen/newline
once native layout confirms a compound wrap. An unbroken title has no visible
hyphen; its accessible label remains Wissenscheck. The first Android soft-hyphen
probe did not display a hyphen and was excluded from the published evidence.
The final implementation uses native wrap measurement instead of relying on
platform-specific discretionary-hyphen rendering.

Fresh Pixel 9 native captures confirm the visible hyphen at 360, 320 and about
280 dp with 200 % font scale, and the unbroken title without a hyphen at about
411 dp / standard font. At 360 dp the complete title stays beside Back; at
320/280 dp it uses the full-width fallback so Wissens- stays complete. Tools-button
overlays and unsettled keyboard captures were excluded. The published normal
capture has a focused input with the keyboard dismissed. This is a header-only
follow-up, not a repeated interaction/video matrix or new iOS claim. Source and
capture hashes are recorded in the provenance manifest.

`pnpm check` passes. All 511 UI tests in 99 suites pass, including 8 targeted
header/auth tests. Unit/script code is unchanged; the next remote CI run executes
the complete pipeline. The read-only AVD overlay and task-local servers/caffeinate
were stopped after capture.

## Earlier complete matrix and interaction evidence (before adding the hyphen)

## Decision and source

Job: answer the current question. Hierarchy: question, input/choices and actions,
then navigation/progress. Primary action stays **Beantworten**, with the existing
single-line pill layout at ordinary sizes. Oversized actions must leave a readable
question area and remain reachable through vertical scrolling.

The user's latest preference supersedes the unbroken full-width title: allow
**Wissens / check**, without a visible hyphen, at the compound boundary. Keep the
two complete parts beside Back when they fit; give them a full-width row if a
part would fragment. Existing string titles and timer handling stay unchanged.
The accessible title remains “Wissenscheck”. The shared heading-only 1.75 scaling
curve stays in place; body and controls retain full system scaling.

These new comparisons use the previous PR UI at `dc8787fe` as **before**, and
UI commit `5bfad4b0` as **after**. They compare the latest design revision,
not the original main implementation. Native source snapshots exactly match
those commits; hashes are in `day-513-native-provenance.json`. Follow-up
`610c08d0` only restores the prior accessibility-label behavior of plain string
titles; compound-title labels and captured visual layouts remain unchanged.

Both sides render the actual complete session screen in native Expo 57 / React
Native 0.86.3 development clients. The synthetic DEA question is fixed. Auth,
Convex operations, analytics, haptics and navigation destinations are stubbed;
fonts, theme, header, timer, input, buttons, choices, selection controls and scroll
are real. Pending evaluation uses an unresolved fixture action, not a server.

All screenshots are native captures. Comparison images only add labels and place
equally scaled originals side by side. No app pixels are retouched.

## Emulator diagnosis and stabilization

The earlier run exhausted host disk space and ran under substantial memory
pressure. Its incomplete captures were excluded. This rerun began with 7.9 GiB
free and no concurrent mobile simulator. The existing AVD booted in about 24 s
with conservative software graphics:

```sh
$HOME/Library/Android/sdk/emulator/emulator \
  -avd DAY_169_Pixel_9 -read-only -no-window -no-audio -no-boot-anim \
  -no-snapshot-load -no-snapshot-save -gpu swiftshader_indirect \
  -memory 2048 -qemu -m 1536
```

`android-runtime-doctor` established the SDK/AVD availability before startup.
`lsof` verified that original userdata was open read-only and a temporary overlay
was active before replacing the dev client. Original accounts and AVD data were
preserved. Android and iOS ran sequentially. No `am_anr` or `am_crash` events
occurred in the final Android matrix and interaction run.

Each non-timed scenario waits for its unique native fixture revision in the UI
hierarchy before capture. Scroll resets start inside the measured scroll region,
including at 280 dp. Stock `uiautomator dump` cannot settle while the real 1 Hz
countdown continuously updates; timed screenshots instead retain the running
timer and are directly visually verified. A blocked idle check is not treated
as an app ANR. Android's accessibility tree can include buttons behind the IME;
interaction checks therefore use actual visible IME insets before tapping.

## Current native matrix

Android: Pixel 9 AVD, API 36, 1080×2424 pixels. Same device/settings per comparison.

| Width / display density | Font scale | Verified behavior |
| --- | --- | --- |
| About 411 dp / 420 | 1.0 and 1.15 | Matched before/after; complete single-line title, original single-line Beantworten and ordinary layout |
| About 411 dp / 420 | 2.0 | Native current-UI maximum-font screenshot |
| 360 dp / 480 | 2.0 | Matched before/after; Wissens/check, complete actions |
| 320 dp / 540 | 1.0 | Complete single-line title and original labels; vertically arranged actions |
| 320 dp / 540 | 2.0 | Matched before/after; Wissens/check; question, input and actions reachable |
| About 280 dp / 617 | 2.0 | Additional stress case: whole title parts in their own row; question and both actions reached by native scroll |
| 320 dp / 540 | 2.0, timed Praxis | Running countdown, Back, complete Praxis title, question and actions |
| 320 dp / 540 | 2.0, dark theme | Complete title and action labels in actual dark tokens |
| 320 dp / 540 | 2.0, software keyboard | Enter Fangzustand with visible keyboard; native scroll dismisses IME by the shared on-drag contract; enabled Beantworten is reached and pressed; actual Analysiere state appears |
| 320 dp / 540 | 2.0, multiple choice | Traverse all four choices; D has checked=true after native tap; full last choice and enabled Beantworten visible; Back reaches fixture destination |

A supplementary iPhone 17 Pro / iOS 26.5 maximum-Dynamic-Type native screenshot
confirms the current Wissens/check title. Initial iOS bundling and unsettled
font-resize captures are excluded; no new full iOS interaction matrix is claimed.

The Android client is EAS build `115ecf95-94a3-4628-9504-96d03c8abc12`.
The iOS client is build `9efabeef-8d3b-41cd-8c81-b186bb57ed34`.

## Video observations and complete-timeline coverage

`android-320-max-written.mp4`:

- 00:00–00:01: previous PR title in its own row.
- 00:02–00:10: switch to Wissens/check; existing autofocus/keyboard dismissal and scroll reset settle.
- 00:11–00:17: settled maximum-font question and complete actions.
- 00:18–00:26: native input focused with visible software keyboard.
- 00:27–00:30: Fangzustand entered.
- 00:31–00:34: native scroll dismisses the keyboard; enabled Beantworten becomes visible.
- 00:35–end: actual pending evaluation, disabled controls, spinner and complete Analysiere label.

Coverage: 39.58-second video; 40 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.

`android-320-max-choice.mp4`:

- 00:00–00:03: complete question/header and action area.
- 00:04–00:10: traverse question and answer A.
- 00:11–00:16: answers B/C and then D enter the reading area.
- 00:17–00:19: D selected; Beantworten enabled.
- 00:20–00:26: entire last choice and both actions visible after scrolling to the end.
- 00:27–end: native Back reaches “Zurück zum Lernplan”, the fixture destination.

Coverage: 30.02-second video; 30 full-timeline frames sampled at 1 fps (1-second interval); 2 contact sheet(s); no audio stream.

Every full-timeline contact sheet for both videos was visually inspected. Audio
transcription is not applicable. Sampling establishes content, state transitions
and reachability, not frame-perfect animation smoothness or physical-device speed.

## Verification and bounds

Two new header regressions ran red against the previous implementation, then
green with compound wrapping. The full UI run then caught a duplicate accessible
name on the password-reset screen caused by applying the explicit header label to
plain string titles. The follow-up limits that label to compound titles. Targeted
header/auth verification passes all 7 tests. Final `pnpm check` passes Biome,
ESLint and TypeScript; unit verification passes 1,068 tests in 138 files plus
18 script tests, and the final complete UI run passes 510 tests in 99 suites
(1,596 tests total). The initial full UI run exposed the regression; the final
full UI rerun is green. Independent Standards
review: 0 actionable findings. Independent Spec review: 0 findings. The earlier
CodeRabbit keyboard-offset finding remains fixed; its content-clipping suggestion
was not reproduced in complete native traversal.

These are native fixture checks, not production-account end-to-end verification.
Physical devices, vendor font substitutions, tablets, landscape, iOS Display Zoom,
spoken VoiceOver/TalkBack, server evaluation and the full completion flow remain
outside this evidence. Dayova's actual fonts are Poppins Regular/SemiBold.
