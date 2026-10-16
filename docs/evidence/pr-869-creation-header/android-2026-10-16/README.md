# Android navigation controls — DAY-523

Jakob requested matching back/close controls in #869 and the same navigation
pattern across the app. Decision/spec:
[DAY-523](https://linear.app/dayova/issue/DAY-523/unify-app-wide-back-and-close-navigation-controls).

## Source and capture contract

- Before this follow-up: `05fcc47b2785090e39cd5be20affc7006edaae82`.
- Implemented source: `e4e1e530` (this directory is a later documentation commit).
- Android 16 / API 36, `Dayova_PR836` emulator, 1080×2400, 420 dpi;
  installed development client `com.dayova.dev` 1.0.5; Metro dev bundle.
- Captured 16 October 2026. PNGs are unmodified native `adb screencap` output.
  Full MP4s are native `adb screenrecord` output without audio. The explicitly
  labeled seven-second baseline excerpt is trimmed/re-encoded at 10 fps from
  that recording; no UI pixels were added or replaced.
- **Isolated native component preview, not an authenticated route/E2E run.**
  The fixture mounts the real production creation header, ExamTypePicker,
  Button, shared sheet and theme/safe-area/keyboard providers. Only selection
  and navigation callbacks are local: back/close reset the selected exam type;
  Continue has no route action. No Clerk/Convex data or credentials are used.
- The fixture reproduces the screen's existing spacing. The original entry
  route's back, exit, saved-exam return and draft-pause behavior are covered by
  existing UI tests; this recording does not establish those route transitions.
- The prior iOS screenshots in the parent directory remain historical evidence
  for the unchanged native SwiftUI creation-header implementation. No fresh iOS
  simulator/device was available on this Windows host.

## Changes and app-wide audit

`NavigationIconButton` is the shared implementation behind BackButton and
CloseButton: 48pt circle, card fill, semantic border, 20pt text-color Hugeicon,
2.4 stroke, 8pt hit slop, shared pressed/disabled/web-focus behavior. The old
close control was 40pt with a 24pt path-3 icon on path-2 fill. Its extra 48pt
creation-header wrapper is removed.

All ordinary back-button uses inherit this implementation. The audit also
migrated the password-reset and subscription-screen local clones, removed the
44pt session-header overrides and the onboarding's smaller/thinner arrow.
All sheet/modal closes inherit the shared DayovaSheetFrame control; its header
minimum is now 48pt, with the existing separate close row at large text sizes.
Contextual labels, callbacks, confirmation behavior and disabled/busy state
remain supported. The material-removal X is a content action, not navigation.
The native iOS creation pair remains the explicitly scoped platform exception:
equal 48pt hosts, native glass on iOS 26+, bordered on earlier iOS.

## Screenshots

| State | Before | After |
| --- | --- | --- |
| Android light, font scale 1.0 | [PNG](before-android-light.png) | [PNG](after-android-light.png) |
| Android dark, font scale 1.0 | [PNG](before-android-dark.png) | [PNG](after-android-dark.png) |

Additional head captures:

- [Light sheet with keyboard](after-android-sheet-light.png)
- [Dark sheet with keyboard](after-android-sheet-dark.png)
- [Dark header at font scale 2.0](after-android-large-text.png)
- [Dark sheet at font scale 2.0](after-android-sheet-large-text.png)

Android UI hierarchy measurements at scale 1.0 and 2.0: back bounds
`[84,137][210,263]`, close bounds `[870,137][996,263]`. Both are 126×126 physical
pixels = 48×48 dp at 420 dpi. The former close visual bounds were
`[881,148][986,253]` = 40dp. At scale 2.0 the sheet close has its own row,
bounds `[902,137][1028,263]`, and remains reachable above the keyboard.
The longer sheet content scrolls; the fixed single-line input placeholder can
extend past its visible text area at this scale. This task does not change the
input's existing horizontal text behavior.

## Recordings and inspection

- [Head: selection, back, close and sheet opening](after-android-light.mp4)
- [Before: clear seven-second baseline excerpt](before-android-light-excerpt.mp4)
- [Before: complete unmodified baseline recording](before-android-light.mp4)

The baseline was rebuilt with a cleared Metro cache and its original 40dp close
bounds verified before capture. The light baseline PNG was freshly recaptured;
the dark baseline PNG is from the preceding preview at the same `05fcc47b`
source. The full baseline recording has intermittent black/partial encoder
frames from about 00:08.5 onward. Treat it as capture-limited, not as proof of
an app rendering defect or reliable interaction timing. The excerpt shows only
the clear static 00:00–00:07 baseline view, with no interaction claim. The full
source is preserved so the limitation is reviewable.

Head observations: selection is visible at 00:15, the back callback has cleared
it at 00:17; selection is visible again at 00:19, the close callback has cleared
it at 00:21. The sheet appears at 00:24 and its header/keyboard remain visible
through the end. Its close callback was additionally tapped outside the clip,
including the separate row at font scale 2.0.

Coverage: 40.30-second video; 40 full-timeline frames sampled at 1 fps
(1-second interval); 3 contact sheet(s); no audio stream.
All three head sheets were inspected. Baseline coverage:

Coverage: 23.85-second video; 48 full-timeline frames sampled at 2 fps
(0.5-second interval); 3 contact sheet(s); no audio stream.

Coverage: 7.00-second video; 14 full-timeline frames sampled at 2 fps
(0.5-second interval); 1 contact sheet(s); no audio stream.

All three full-baseline sheets and the excerpt sheet were inspected.
This establishes visible states and head callback
results at the cited timestamps, not continuous animation smoothness. There is
no audio/transcription. The review's generated contact sheets, frame index and
manifest remain in local scratch; the original MP4 is preserved here.

## Validation and limits

### Pause/resume follow-up

The review found that the saved-draft pause sheet promised retained edits, but
its confirm callback navigated away without persisting locally edited topics.
Two regression cases failed on `39992a9c`: no save call before exit, and no
retained sheet/error after a rejected save. The correction waits for the existing
`updateRequiredTopics` mutation (which also updates the linked exam), prevents
duplicate/pending exit actions and keeps the sheet and input on save failure.
Unchanged topics do not cause a write. Invalid local edits stay available for
correction instead of being discarded. The final focused run passed **37 UI
tests and 16 navigation/overview/routing unit tests**, plus TypeScript and
targeted Biome/ESLint/diff checks. Independent standards/spec reviews found no
remaining issue. This logic correction was verified through route component
tests; the native captures above still show the unchanged control appearance
and do not claim a fresh authenticated pause/resume run.

| X pressed in… | Result | Persistence |
| --- | --- | --- |
| Initial exam form (type/subject/date) | Home, no confirmation | Unsaved form edits are not autosaved; an already saved exam is not deleted |
| Topics before a plan draft exists | Saved exam detail, no confirmation | Saved exam remains; local topic edits are not automatically saved |
| Topics/material on an existing draft | “Lernplan-Erstellung pausieren?” → “Weiter bearbeiten” or “Später fortsetzen” | Pause saves changed topics before exit; uploads remain stored; failure keeps the form open |
| Material analysis / scope confirmation | Learning-plan overview, no pause sheet | The existing saved draft remains resumable; in-flight analysis must not navigate back into creation after X |

History: [#242](https://github.com/Dayova/dayova-mvp/pull/242) was closed when its
old setup-quiz architecture was superseded. Release-native resumption was merged
through [#485](https://github.com/Dayova/dayova-mvp/pull/485) and
[#489](https://github.com/Dayova/dayova-mvp/pull/489). It is still present in
`learning-plans.tsx`: unaccepted drafts appear under **In Erstellung**, with
**Lernplan-Erstellung fortsetzen** and the next incomplete step. This is an
overview card/section, not a newly added global banner. The separate 24-hour
reminder [DAY-189](https://linear.app/dayova/issue/DAY-189/remind-learners-to-resume-unfinished-learning-plan-creation)
remains Todo.

### Earlier control validation

- Focused UI runs passed: 91 tests (shared controls, sheets, subscription,
  auth, creation header), then 104 tests (final controls/onboarding and creation
  flow/setup dispatch). Overlapping tests are not counted as distinct totals.
- TypeScript, targeted Biome and ESLint, and `git diff --check` passed.
- Independent standards and spec reviews: no remaining findings after removing
  the session/onboarding overrides. CodeRabbit CLI was attempted but blocked by
  the account review-capacity limit; no successful CLI review is claimed.
- Native inspection covers the creation header and one representative shared
  sheet in light/dark and at 2.0 font scale. Auth/subscription/session callers
  were audited in source; their complete native routes were not exercised here.
- TalkBack traversal, physical-device QA, web keyboard navigation, fresh iOS
  sheet/auth/session rendering and full authenticated creation flows remain
  manual review/release checks. Component tests do not substitute for them.
- These follow-up artifacts compare against the previous #869 head, not the
  original `main` base. They do not resolve the handbook's missing original
  base/head full-flow recordings or the existing human review hold.

## Reproduction

`preview.tsx.fixture` preserves the exact temporary preview source. To rerun,
copy it to `.tmp/pr869-preview.tsx` at the repository root and temporarily point
`index.ts` at `registerRootComponent(Preview)`. Use the normal development client
with the branch's frozen dependencies, then restore the real `index.ts` and
remove the temporary mount. The fixture is not imported by the shipped app.
Use a fresh Metro bundle when switching source revisions; verify the native
button bounds/appearance before recording. Theme follows Android system
appearance; set `font_scale` to 1.0 or 2.0 as labeled above.
