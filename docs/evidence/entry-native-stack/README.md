# Entry native history verification — 2026-09-21

This change was originally stacked on PR #494. After #494 merged, PR #698 was
merged with the 2026-09-25 `main` and retargeted there. The original native
recordings used #494's `69ba928a4be7ff01ed7f8ac333deeecc0270c4e4` head;
the branch was refreshed after those runs.
The entry flow now has actual native predecessors instead of changing local step
state inside a single native route. See mobile-app ADR 0004.

## Automated checks

The final checks used an installed dependency tree whose `package.json` and
`pnpm-lock.yaml` are byte-for-byte identical to this branch (including RN 0.86.3,
Expo 57.0.20, and Router 57.0.19). Native-runtime alignment described below applies
only to simulator/emulator verification.

- Vitest: 118 files, 764 tests passed.
- Jest: all 67 suites / 288 tests passed, including the cold-URL parser regression
  and all 11 creation-flow interaction tests.
- Node script tests: 18 passed (Android autolinking, Metro cache/watcher, skills).
- TypeScript, changed-source Biome/ESLint, and whitespace checks passed.
- CodeRabbit CLI reviewed the uncommitted implementation twice; both completed
  with zero findings. `coderabbit.jsonl` records the second review.
- Independent Standards review found no documented-standard violations; its
  nonblocking suggestion was to consider a narrower draft mutation API later.
- Independent Spec review found cold URLs put query parameters on the leaf,
  not necessarily the parent layout. Initialization was moved to the leaf; the
  actual Expo URL parser plus a rendered native-stack-state test now covers this.
  The follow-up review found no remaining confirmed specification issue.

The interaction tests cover actual StackRouter state, prior answers, complete
and incomplete resume, fresh-draft isolation, homework notes, duplicate saves,
and recovery after a failed save. External destinations are mocked in these tests;
real native route replacement is checked below.

### 2026-09-24 resume-link review follow-up

The review found that a partial availability URL could restore the full stack
without a saved exam ID or valid date. A final integrity review also found that
an omitted duration could overwrite the existing exam with a default. The
first-step initializer now accepts a resume only when its exam ID, subject,
exam type, canonical day key, and bounded integer duration are all present and
valid. An incomplete link starts a fresh exam at Exam type and does not retain
the old exam ID or prefills. The rendered navigation regression failed on the
previous code for missing ID, missing date, invalid date, missing duration, and
invalid duration; it passes after the fix. A save-path test confirms that a
restarted flow cannot update the old exam. A complete cold resume still restores
all predecessors. CodeRabbit subsequently identified that three malformed-link
cases omitted duration as well as their named field. Each case now starts from a
fully valid resume and changes only one field, so it exercises its own guard.
The later repeated-query follow-up initially missed `type=exam&type=exam`:
normalization dropped the repeated type and initialized a homework draft.
The real Expo parser-to-screen regression failed on that behavior. Repeating
the exam type now starts a clean exam without retaining a saved exam or its
fields; the regression passes.

After refreshing the stack against the 2026-09-24 `main`, the combined branch
passed 68 Jest suites / 311 tests, 121 Vitest files / 826 tests with two
workers, TypeScript, Biome, ESLint, and whitespace checks. The Jest suites ran
in seven bounded batches after the single-process run crashed in the local
native test runtime. The smaller Vitest worker count avoids local timeouts
caused by concurrent Expo config subprocesses. CodeRabbit CLI reviewed the
saved-plan follow-up with zero findings. The native recordings below predate
the URL-validation and saved-plan changes; they remain evidence for the
unchanged entry gesture mechanics and the complete resume path.

After merging `main` at `cb5dda0a` on 2026-09-25, the combined tree at
`4cecd90b` passed 121 Vitest files / 820 tests, 69 Jest suites / 315 tests,
18 Node script tests, TypeScript, Biome, ESLint, and whitespace checks. The
installed dependencies were shared read-only with another local checkout, so
the test, lint, and typecheck binaries were invoked directly; the repository's
`pnpm` wrapper attempted a dependency reinstall and was not used for this run.
EAS CI on the retargeted PR remains the authoritative clean-install check.

## Native test scope

Native verification uses isolated data and the actual entry routes, provider,
step screens, creation layout, shared navigation helper, and learning-times
screen. The surrounding Home, topics, and saved-exam destinations are fixtures.
Auth, Convex queries/mutations, and analytics are replaced locally. No backend
writes occur. The fixture's displayed write count is diagnostic, not a reactive
assertion of saved records. Exact mutation IDs/counts are asserted by Jest.

Maestro 2.9.0 runs the YAML files in this directory against that harness on Metro
port 8094. These files require the fixture routes/buttons; they are evidence
protocols, not standalone production smoke tests. The temporary app/Metro
configuration and native harness are excluded from the implementation commit.

### iOS

- iPhone 16 simulator, iOS 26.5; installed dev client `de.dayova.app-dev`, 1.0.4 (1).
- Native React Native 0.86.0 / Expo 57.0.8 / Reanimated 4.5.0 / Worklets 0.10.0;
  JavaScript was aligned to this installed runtime. Expo Router 57.0.19 and
  Screens 4.26.2 match the PR's navigation dependencies.
- This differs from the PR lockfile's RN 0.86.3 / Expo 57.0.20 / Reanimated 4.5.1 /
  Worklets 0.10.1. It verifies the actual navigation implementation in a compatible
  development runtime, not an exact release artifact.
- `ios-native-stack.yaml` and its log: passed. Full flow, cancelled/completed
  Subject swipe, Date/Availability swipes, first-step exit, retained answers,
  saved-exam resume, topics return/resave, settings detour, save-without-plan,
  and completed-history cleanup.
- `ios-final-check.yaml` and its log: passed on the final implementation after
  correcting leaf initialization. Rechecks resume date, cancelled/completed
  Subject swipes, in-flight-save protection, destination cleanup, and homework
  forward/swipe-back/root exit. Simulated save takes 15 seconds so Maestro can
  attempt the swipe before completion.

Earlier follow-up attempts were invalid test runs: a five-second fixture save
finished before Maestro sent the swipe, and reopening an already running dev
client briefly exposed the previous Home before reload. The final run terminates
that app before opening the dev-client URL and uses the longer save delay.

### iOS recording observations

The attached `entry-native-stack-ios.mp4` records the expanded flow before the
leaf-initialization correction. That correction is covered by the final native
follow-up and cold-parser test. Native gesture handling is unchanged between them.

- Approximately 41–43 seconds: partial Subject swipe exposes Exam type and cancels
  back to Subject. Approximately 45–46 seconds: completed swipe settles on Exam
  type, preserving Klausur. Home is not the revealed predecessor.
- 55–81 seconds: Date and Availability go back one step; exiting the first step
  returns Home.
- 85–114 seconds: saved exam resumes at Availability with Date/Subject history;
  continuing to topics, returning, and saving again works. Back from the completed
  destination returns Home without reopening completed steps.
- 116–144 seconds: learning-time settings return to the same availability draft;
  earlier answers remain usable, save-without-plan reaches details, then Home.

Coverage: 150.06-second video; 79 full-timeline frames sampled at 0.533132 fps (1.875708-second interval); 5 contact sheet(s); 61 additional frames from 00:00:40.000 to 00:00:47.000 at 5 fps; no audio stream.

All five full-timeline sheets and four focused sheets were inspected, along with
individual transition frames and the final decoded frame (Home). The focused
sampler duplicates some tail frames at its end boundary; those are not treated
as additional temporal evidence. This is sampled coverage, not every-frame
inspection or a frame-time/performance benchmark. No audio/transcription exists.

### Android

- `DAY_169_Pixel_9`, Android 16 / API 36; installed dev client `com.dayova.dev`,
  1.0.4 (1). Native RN reports 0.86.0; the same compatible JavaScript runtime and
  current navigation dependencies listed above were used.
- Gesture navigation was already enabled (`navigation_mode=2`). The existing AVD
  ran headlessly with SwiftShader, 2 GB RAM, and no snapshot loading/saving.
  Tests used font scale 1.0 / density 420; the pre-existing 2.0 / 480 settings were
  restored and verified afterward. This is not a large-text layout test.
- `android-native-stack.yaml` and log: passed. Physical edge swipes and system
  Back go one step at a time; selected answers survive. Covers first-step exits,
  full saved-exam resume history, topics return/resave, learning-time settings,
  save-without-plan, completed-history cleanup, busy system Back, and homework.
- `android-final-check.yaml` and log: passed. System Back dismisses the native
  date picker while retaining Date; an edge swipe during a delayed save retains
  Availability until completion.
- `android-cancel-check.yaml` and log: passed after an injected cancellation:
  `adb shell input touchscreen motionevent` sends DOWN at (1,1212), MOVE through
  x=60,180,310,180,60,1 at the same y, then UP at (1,1212), with 80 ms between
  commands. Subject remains active; a subsequent completed edge swipe returns
  Exam type and system Back returns Home.

### Android recording observations

The attached `entry-native-stack-android.mp4` records the final implementation.

- 32.17–32.67 seconds: Android's Back indicator appears over Subject. Around
  33.67–33.83 seconds the native transition settles on Exam type with Klausur
  retained; Home is not shown in this focused transition.
- 45–68 seconds: system Back and edge gestures consume internal step history,
  then exit to Home only from the first step.
- 74–136 seconds: saved-exam resume retains 30 September, topics return/resave
  succeeds, and Back from the completed destination returns Home.
- 139–191 seconds: missing learning time opens the real settings screen, returns
  to the retained draft, saves without a plan, and exits details to Home.
- 204–224 seconds: Availability remains active through the simulated pending save
  and attempted system Back, then advances to the topics fixture.
- 230–243 seconds: homework goes forward and back via both system Back and the
  edge gesture, then exits to Home.

Coverage: 259.33-second video; 80 full-timeline frames sampled at 0.308488 fps (3.241622-second interval); 5 contact sheet(s); 29 additional frames from 00:00:32.000 to 00:00:36.000 at 6 fps; no audio stream.

All five full-timeline and two focused sheets were inspected, including an
individual transition frame. The focused sampler repeats end-boundary frames;
these do not establish additional timing. Emulator/software-rendering timings
are not a performance benchmark.

The short [completed-Back excerpt](https://github.com/user-attachments/assets/e7b93856-fbe3-4696-9226-75ef4b707c9f)
is trimmed from the already attached continuous Android recording; it does not
combine different runs. It shows Subject with Chemie selected at 0.5 seconds,
the Android Back indicator around 1.5–2.5 seconds, and Exam type with Klausur
retained by 3 seconds and through the final decoded frame. The excerpt was
trimmed and re-encoded at a constant 30 fps without changing the frame order
or playback speed. Its full
timeline contact sheet and final decoded frame were inspected.

Coverage: 6.00-second video; 12 full-timeline frames sampled at 2 fps (0.5-second interval); 1 contact sheet(s); no audio stream.

The separate [cancellation-only clip](https://github.com/user-attachments/assets/3524dc96-6261-41d4-acf1-445dbf43ff88)
shows the Back indicator at approximately one second, followed by unchanged
Subject/selected Chemie from 1.5–10.5 seconds. A second Back swipe begins
around 11.4 seconds, but the final decoded frame at 11.755 seconds still shows
Subject with its Back indicator; the recording stops before its result. The
Maestro log covers that later completed swipe, but this clip alone is evidence
only for the cancellation. It was removed from the top-level PR description
because an unlabeled viewer could reasonably read it as a failed Back gesture.
Both full-timeline sheets, focused transition sheets, and the final frame were
inspected.

Coverage: 11.79-second video; 24 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.

## Release-build check and remaining scope

An [iOS simulator release build](https://expo.dev/accounts/dayova/projects/dayova/builds/210ca4b3-ca1a-41d5-a52b-e5e2e3d0e945)
from `bf6e0fec` finished successfully using the current lockfile, production
environment, `ota-staging` channel, and `de.dayova.app` bundle ID. It was
installed and cold-launched on the iPhone 16 / iOS 26.5 simulator. After the
user signed in, the authenticated release app could be exercised without
creating or modifying records:

- Exam creation: header Back moved Availability → Date → Subject → Exam type →
  Home, preserving selections on each preceding step. This run opened exam
  creation from Home; the first-step destination follows the entry origin.
- Homework creation: header Back moved Planning → its first step → Home,
  preserving the subject selection.
- An existing unfinished plan opened from Plans at Material. Header Back went
  to Topics instead of the Plans list. This reproduced the reported caller
  history bug. On Topics, the pause confirmation appeared, but choosing
  “Später fortsetzen” left Topics visible. The native removal guard was still
  active when the destination action ran.

The final app-source follow-up marks a Material route opened from Plans with
`origin=learningPlans`, so Back targets Plans; Material reached from the
creation flow still returns to Topics. Exits now disable the native removal
guard before dispatching the destination action. The tests exercise both
routes and assert the guard is disabled at dispatch. The new exact-source
[iOS simulator release build](https://expo.dev/accounts/dayova/projects/dayova/builds/269a12c8-c26d-46a2-a0b1-5f7d358b2b89)
uses commit `a9f23cfd`, production configuration, `ota-staging` channel, and
the current lockfile. It finished and installed over the signed-in app on the
same iPhone 16 simulator. Auth persisted. In this release build:

- Opening Material from the unfinished plan card and pressing header Back
  returned to the Plans list, not Topics.
- Opening a saved plan at Review, then pressing Back to Material and Back again
  reached Topics; this in-flow Material route still moves one setup step back.
- Pressing Back on Topics showed the pause confirmation. Choosing “Später
  fortsetzen” returned to the Plans list, fixing the earlier stuck exit.
- Force-closing and reopening the release app preserved the signed-in Home.

On 2026-09-25, the same signed-in `a9f23cfd` release build passed the
[Plans-origin Maestro flow](ios-plans-origin.yaml) with its
[assertion log](ios-plans-origin-maestro.txt): Pläne → new exam → the first 20%
step → header Back returned to Pläne; repeating the route and completing a
650 ms left-edge swipe also returned to Pläne. Neither path created an exam.
This checks the actual caller destination rather than assuming Home. The
current PR head has newer resume-URL validation and a merge from `main`, but
the first-step Back implementation is unchanged from this tested build.

The earlier Simulator UI drag input did not trigger a native edge swipe in
this release binary. Maestro did verify the first-step release-binary edge
gesture from Pläne above. Intermediate release-binary gestures remain
unverified; the separate native iOS development-client recordings cover
completed and cancelled edge swipes through those steps.

The simulator also has a development client registered for the `dayova` URL
scheme. Safari dispatched a `dayova:///entry/new?type=exam` cold link to that
development client, even after the release app was reinstalled and force-closed,
so this did not verify release-app cold-link handling. The real Expo parser
regression covers the leaf-only cold URL shape, retained exam ID, date,
duration, and reconstructed
predecessors. Expo development builds do not support custom-scheme cold launch
testing in the same way as release builds
([Expo documentation](https://docs.expo.dev/develop/development-builds/development-workflows/)).
