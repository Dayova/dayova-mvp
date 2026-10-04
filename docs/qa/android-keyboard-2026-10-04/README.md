# Android keyboard visibility — 2026-10-04

## Result and cause

Opening “Fach hinzufügen” on the unchanged `098a1851` baseline reproduced the
reported obstruction on Android. The native visibility check failed with a
visible IME starting at y=1035: “Name des Fachs” was covered/missing. With the
shared sheet fix, the same control was at [78,629][642,671], above that IME.

The root KeyboardProvider keeps Android's edge-to-edge container at full height.
Gorhom's `adjustResize` branch assumes a shrinking container and skips its keyboard
height offset. `DayovaSheetFrame` now uses Gorhom's `adjustPan` calculation.
This is a sheet calculation setting; the fix does not change the manifest's
window mode. Onboarding/verification and written learning-session answers also
use the existing KeyboardSafeScrollView and the controller's KeyboardAvoidingView
on both mobile platforms.

## Input inventory

All production Input, TextField, TextInput, PillTextInput, FormPill, Textarea and
TextAnswer usages were traced to their scrolling/container strategy.

| Area | Strategy after change | Evidence |
| --- | --- | --- |
| Add personal subject, including selection from exam/homework/timetable/learning-plan flows | Shared DayovaSheetFrame + registered sheet input | Android component capture and native bounds check; caller propagation checked in code |
| Rename personal subject | Same frame | Android capture and bounds check at font scales 1.0, 1.5 and 2.0 |
| Custom exam type | Same frame | Android capture and bounds check |
| Onboarding name/email/password | Controller avoiding view + keyboard-safe scrolling for text steps | Native name component capture; all text steps checked in code; auth UI tests |
| Registration/login verification code | Controller avoiding view + keyboard-safe scrolling | Native verification component capture and bounds check; auth UI tests |
| Written learning-session answers | Keyboard-safe scrolling + controller avoiding view for action row | Native TextAnswer composition capture and bounds check |
| Login, password recovery, onboarding recovery | Existing KeyboardSafeScrollView | Code audit and auth UI tests |
| Profile, password change, forced password reset | Existing ScreenScroll/KeyboardSafeScrollView | Code audit; forced-reset UI tests |
| Exam/homework titles and notes, timetable room, learning-plan topic entry | Existing ScreenScroll/KeyboardSafeScrollView | Code audit |

## Capture environment and limits

DAY_169_Pixel_9, Android 16/API 36, current native development APK built from this
checkout (Expo SDK 57/RN 0.86.3). The capture resolution was 720×1616 at 280 dpi,
which preserves the emulator's normal logical viewport (~411×923 dp); screenshots
were not cropped or retouched. System font scale was 1.0 unless named otherwise.
Gboard text and numeric keyboards were exercised. Display settings and the
pre-existing emulator launch service were restored after QA.

These are **native component QA captures**, using real production components and
providers in an offline temporary entry point. The actual personal-subject screen
and exam-type picker were rendered. Auth views were rendered without router
metadata; the written-answer capture composes the production TextAnswer with the
same scrolling and action-row strategy. Rename captures use a synthetic subject.
No account, subject or learning-session data was saved. The temporary entry,
auth exports/router metadata change and subject data fixture are absent from the
production diff. Captures establish keyboard/layout behavior, not authenticated
end-to-end navigation or persistence. Samsung keyboards and native iOS were not
run in this pass.

## Repeatable native visibility check

Open the relevant form in a development build, focus its field and run:

```sh
python3 docs/qa/android-keyboard-2026-10-04/assert-above-keyboard.py 'Name des Fachs'
python3 docs/qa/android-keyboard-2026-10-04/assert-above-keyboard.py 'Neuer Fachname'
python3 docs/qa/android-keyboard-2026-10-04/assert-above-keyboard.py 'Name der Prüfungsart'
python3 docs/qa/android-keyboard-2026-10-04/assert-above-keyboard.py 'Bestätigungscode'
python3 docs/qa/android-keyboard-2026-10-04/assert-above-keyboard.py 'Antwort'
```

The helper reads live Android window insets and UIAutomator bounds. It requires a
visible IME and fails for an absent, empty or covered control. `--adb` and
`--serial` can select another SDK/device. Also check the screenshot, action
reachability, keyboard dismissal and refocusing; a mocked JS tree cannot prove
native geometry. Repeat with enlarged system text, restoring the prior setting.

At font scale 1.0, add-subject and custom-exam inputs ended at y=671 against an
IME top of 1035; rename ended at 797. Verification ended at 495 against 1112.
The name-step “Weiter” action ended at 930 against 1035. Rename input ended at
683 at scale 1.5 and 764 at scale 2.0, against 1035 in both cases. These checks
also passed after hiding and reopening the keyboard.

## Review media

Native screenshots and unedited H.264 recordings are attached to the pull request.
Local copies of PNG/MP4 media are ignored to keep binaries out of the repository.
Each clip covers opening/focusing, typing, keyboard dismissal and refocusing.
The full timelines were sampled with inspect-video-evidence and every generated
contact sheet was visually inspected. All clips have no audio stream. Sampling
supports the observed layout transitions; it does not exclude artifacts shorter
than the sampling interval. The observations/coverage table is in the PR.

## Automated validation

- TypeScript: `pnpm exec tsc --noEmit`.
- Full repository lint: `pnpm lint` (Biome and ESLint).
- Six relevant UI suites: 93 passing tests covering sheet lifecycle/input
  registration, auth, subject add/edit, custom exam types and forced reset.
- Native APK: `app:assembleDebug`, arm64-v8a, successful.
- Final regular app entry: Android Expo export with Hermes, successful.
- Native geometry: failing baseline, passing fixed controls and refocusing.

The auth suite's native controller is mocked only to run its JS behavior tests;
native keyboard positioning is established by the separate Android evidence.
