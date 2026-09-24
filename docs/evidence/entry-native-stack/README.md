# Entry native history verification — 2026-09-21

This change is stacked on PR #494 at `69ba928a4be7ff01ed7f8ac333deeecc0270c4e4`.
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
without a saved exam ID or valid date. The first-step initializer now accepts a
resume only when its exam ID, subject, exam type, and canonical day key are all
present and valid. An incomplete link starts a fresh exam at Exam type and does
not retain the old exam ID or prefills. This prevents saving a partial link from
silently changing the referenced exam's date. The rendered navigation regression
failed on the original code for missing ID, missing date, and invalid date; it
passes after the fix. A save-path test also confirms that a restarted flow cannot
update the old exam. A complete cold resume still restores all predecessors.

After this follow-up, local validation passed: 67 Jest suites / 292 tests,
118 Vitest files / 764 tests, TypeScript, Biome, ESLint, and whitespace checks.
The native recordings below predate this URL-validation change; they remain
evidence for the unchanged gesture mechanics and the complete resume path.

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

The separate cancellation clip shows the Back indicator at approximately one
second, followed by unchanged Subject/selected Chemie from 1.5–10.5 seconds. It
ends as the next completed swipe starts; the Maestro log covers that destination.
Both sheets and individual before/after frames were inspected.

Coverage: 11.79-second video; 24 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.

## Remaining release checks

Neither an OS-killed cold deep link nor the exact current-lockfile release binary
has been verified natively. Expo development builds do not support custom-scheme
cold launch testing in the same way as release builds ([Expo documentation](https://docs.expo.dev/develop/development-builds/development-workflows/)).
The real Expo parser regression verifies the leaf-only cold URL shape, retained
exam ID, date, duration, and reconstructed predecessors. Repeat OS-killed entry
and saved-exam resume URLs in a current preview/release build before release.
