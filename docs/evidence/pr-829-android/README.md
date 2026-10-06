# PR #829: Android swipe and activation checks

Checked on 2026-10-05 (before) and 2026-10-06 (fixed).
PR: https://github.com/Dayova/dayova-mvp/pull/829

Before code: `14392aa62b349b6f749a17a081f82b6ff75e5d78`.
Fixed code: `565d1cb7aade32a7587f905849bb09c9a67fde20`.
The subsequent evidence commit changes no application code.

## Findings and fixes

- After a settled short swipe, native Android accessibility activation was blocked indefinitely because the touch guard was reset only by a new touch. Accessibility activation now uses an explicit `activate` action, independently of the trailing-touch guard.
- A fresh tap during snap-back could be consumed because an intermediate animated displacement was mistaken for an open action rail. Activation now uses the rail's logical target state.
- A vertical or mostly vertical diagonal drag could open a card when the horizontal pan failed before activation. Finalization now records those drags and suppresses their trailing press. This behavior existed before #829 as well.

Five additional UI regression tests failed against the previous implementation and pass with the fix. The swipe suite now has 14 tests.

## Native results and recordings

All 66 final native route/state assertions pass. Touch gestures were delivered with Android `input`; routes were observed through the real Expo Router store in the running Hermes app. No app press handlers or navigation were mocked. UIAutomator additionally verifies scrolling bounds, the delete confirmation text, and its disappearance after cancellation.

| Recording | Checks | Timestamped visual observations |
| --- | --- | --- |
| [Before: accessibility regression](before-accessibility.mp4) | Fresh activation works; activation after three settled short swipes repeatedly fails; untouched-card and fresh-touch controls work. See [results](before-accessibility-results.json). | The overview persists during repeated failed activation attempts; the successful recovery transition is visible at 00:29.8–00:30.0. |
| [Differential baseline control](baseline-control.mp4) | Same native client, with only #829's screen guard removed: activation after a short swipe works. See [results](baseline-control-results.json). | This exploratory recording includes startup loading. Its initial `found=false` control is excluded; the settled post-swipe activation and subsequent controls are valid. |
| [Fixed: touch](android-touch.mp4) | 46 assertions: ordinary tap/back; 10 long, 10 closing and 10 short swipes; close-then-open; five immediate fresh taps during snap-back; three vertical and three diagonal drags; swipe one card/tap another. See [results](touch-results.json). | 00:08–00:44: actions open/close while overview remains. 00:49–00:62: five separate fresh taps reach plan details and return. 00:63–00:69: vertical/diagonal checks remain on overview. 00:71.33–00:71.67: the other card's plan opens. |
| [Fixed: accessibility](android-accessibility.mp4) | 13 assertions: fresh activation; three settled short-swipe/activation pairs; open rail closes on first activation, plan opens on second; activation after diagonal drag; untouched-card control. See [results](accessibility-results.json). | 00:03, 00:09, 00:15 and 00:19–00:20: plan details after activation. 00:23: rail open; 00:24–00:26: rail closed, overview retained; 00:27: plan details after second activation. The last control's route is recorded in JSON, while the final video frame still shows its accessibility focus. |
| [Fixed: edit/delete/cancel](android-actions.mp4) | Three route assertions plus native UI checks. Edit opens the editor, delete opens only confirmation, cancel closes the dialog and retains Physik. See [results](action-results.json). | 00:05–00:08.5: editor; 00:13–00:21: confirmation; 00:21.5–00:26: overview with Physik retained and dialog absent. Returning from the editor uses a native deep link as test setup. |
| [Fixed: scrolling](android-scroll.mp4) | Four assertions against a four-card list: vertical scroll, diagonal scroll, fresh tap opens Mathematik, reverse scroll. See [results](scroll-results.json). | 00:00–00:03: content moves upward without navigation; 00:04.5–00:08: diagonal scroll reveals Mathematik; 00:09.5–00:11.5: its plan details; 00:12–00:12.5: return and reverse scroll. |

Accessibility checks invoke `AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS` and `ACTION_CLICK` from a native instrumentation helper. `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` preserves TalkBack; TalkBack and touch exploration were verified enabled. This tests the native accessibility action path, not a physical TalkBack double-tap gesture. Ordinary injected taps bypass touch exploration and are counted only as touch tests.

JSON `seconds` values use the host harness's monotonic clock. Video timestamps use recording PTS; they drift under emulator/CPU load and must not be treated as identical clocks or latency measurements. Route events supplement sampled frames.

## Automated validation

- Vitest: **133 files / 954 tests passed** with `node node_modules/vitest/vitest.mjs run --maxWorkers 1`. [Summary](vitest-all-summary.txt).
- Jest: **88 suites / 422 tests passed** with `node node_modules/jest/bin/jest.js --runInBand`. [Summary](jest-all-summary.txt).
- Node test runner: **18 tests passed**, covering Metro cache/watcher, Android autolinking and skill catalog validation. [Summary](node-tests-summary.txt).
- TypeScript `--noEmit`, Biome lint and ESLint passed.
- CodeRabbit CLI 0.7.5 `review --agent -t uncommitted`: three changed code/test files reviewed, zero findings.

The first default-parallel Vitest run, concurrent with native/Jest work, hit four configuration-test timeouts and one scheduled-function completion failure. The full single-worker rerun passed all 954 tests. No tests were skipped or disabled and no backend code was changed to obtain that result.

## Environment and limits

Android 16/API 36 x86_64 emulator, Pixel 9 Pro profile, 720×1600 at density 270, gestural system navigation. Native `com.dayova.dev` development client: Expo 57, React Native 0.86.3, Reanimated 4.5.1 and Hermes. Fixed JavaScript was served by minified Metro from this PR checkout. The reused compatible native APK has SHA256 `64a7edd104dc4950d7c096c2e23418bc4a620da469310e2f72c91e0807817741`; it was not rebuilt from this PR. Dependencies were reused from the existing workspace, without a clean reinstall.

These checks do not establish release-APK behavior, physical-device behavior, multiple Android API levels, or current iOS/VoiceOver behavior. The earlier iOS videos in the PR description remain separate evidence from the combined #829/#830 simulator stand.

Only a synthetic Clerk development account and the configured Convex development deployment were used. Four synthetic plans and their exam entries were removed after the final checks; the test account remains. No credentials are published. PostHog was intentionally disabled, which produced the visible development diagnostic banner in the touch/accessibility recordings. The final action/scroll recordings were made after dismissing that overlay. An earlier action-harness run checked only the route while the overlay covered the cancel button; it was rejected and replaced by the complete, explicit dialog-disappearance rerun published here.

## Video inspection coverage

Every full-timeline and focused contact sheet for the published recordings was visually inspected. [Video metadata, SHA256 hashes and coverage](video-inspection.json) accompany the recordings. No recording has an audio stream; transcription is not applicable. Sampling supports the timestamped screen states above, not every intervening frame or sub-second finger movement.

Coverage: 30.28-second video; 30 full-timeline frames sampled at 1 fps (1-second interval); 2 contact sheet(s); 16 additional frames from 00:00:27.000 to 00:00:30.280 at 5 fps; no audio stream.

Coverage: 33.30-second video; 33 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.

Coverage: 71.98-second video; 72 full-timeline frames sampled at 1 fps (1-second interval); 5 contact sheet(s); 72 additional frames from 00:00:48.000 to 00:01:11.900 at 3 fps; no audio stream.

Coverage: 34.91-second video; 35 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.

Coverage: 26.31-second video; 53 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); no audio stream.

Coverage: 13.20-second video; 26 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.
