# PR #653: matched iPad portrait evidence

Captured 23 September 2026 on Dayova Jakob Review iPad, iPad Pro 11 M4,
iOS 26.4, development client `de.dayova.app-dev`.

- Before: actual PR base `00c5b190714ec2c4946c1190ed6078b6ed77b285`, Metro 8097.
- After: exact PR head `a8cc4472ae71d9e811ca1245efafa24af4ac3127`, Metro 8098.
- [Before screenshot](before.png), [after screenshot](after.png).
- [Before recording](before.mp4), [after recording](after.mp4).

## Observations

Before recording: welcome at 0–1.5 seconds; restart and development-client
loading thereafter; welcome returns at 16–16.5 seconds.
After recording: welcome at 0–2 seconds; restart/loading; welcome returns at
13.5 seconds and remains visible through the last sampled frame at 19.5 seconds.
Startup timing is development tooling, not a production performance benchmark.

The after portrait shows larger, separated decorative rows spanning the iPad
width, a fine central-logo outline, and visible registration/login actions.
No overlap between the decorative rows is visible in the inspected portrait.
The floating Tools gear is development tooling.

All six contact sheets and end-state individual frames were inspected using
the inspect-video-evidence skill. No audio/transcription is present.

Coverage: 16.91-second video; 34 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); no audio stream.

Coverage: 20.08-second video; 40 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); no audio stream.

## Limits and anomalous attempt

An earlier after attempt changed to the login form around 16 seconds without
an intended input. The user confirmed the iPad was free. One subsequent restart
and the repeated recording above did not reproduce that transition. Its cause
is unresolved; this is not a verified navigation fix. The original diagnostic
recording is retained locally at `/private/tmp/dayova-653-ipad-after.mp4`, not
substituted as a successful welcome comparison.

The exact-head login UI suite passed: 49/49 tests, including three iPad geometry
sizes. Invoked with `node_modules/.bin/jest src/features/auth/login-screen.ui.test.tsx
--runInBand --watchman=false`; Corepack/pnpm initially refused a dependency-directory
purge without a TTY, so no purge was authorized.

This closes the missing matched iPad portrait capture, not landscape, Android,
registration, production OTA, or Jakob's independent visual acceptance. Draft
and the reviewer HOLD must remain until the remaining gates are satisfied.
