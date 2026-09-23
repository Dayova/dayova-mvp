# DAY-402 / PR #653 — Android portrait comparison

Captured 2026-09-23 on the dedicated Pixel 9 Android 16 emulator (1080×2424), package `com.dayova.dev`. No production deployment or account mutation.

- Before: actual PR parent `00c5b190714ec2c4946c1190ed6078b6ed77b285`, Metro 8097.
- After: PR head `a8cc4472ae71d9e811ca1245efafa24af4ac3127`, Metro 8098.
- [Before screenshot](before.png) / [after screenshot](after.png).
- [Before recording](before.mp4) / [after recording](after.mp4).

## Observations

Both recordings show Welcome, opening Login, and Android Back returning to Welcome. Before: Welcome 0–2 s, login visible at 3–5 s, return visible at 5.5 s. After: Welcome 0–2.5 s, login visible at 3–5 s, return visible at 6–7.5 s. The head shows larger decorative icons and the outlined central logo tile. Registration and Login remain visible in portrait.

The login email and password dots are source-defined placeholders, not entered credentials (`dayova-auth-flow.tsx`). No authentication was submitted. The floating gear is a development-client overlay. These recordings do not prove registration, authenticated onboarding, landscape behavior, production OTA delivery, or completion of Jakob's visual review.

## Video verification

Both complete timelines and their contact sheets were inspected; relevant individual frames were opened. Sampling cannot rule out sub-0.5-second transients. No audio or transcription.

Coverage: 5.90-second video; 12 full-timeline frames sampled at 2 fps (0.5-second interval); 1 contact sheet(s); no audio stream.

Coverage: 7.86-second video; 16 full-timeline frames sampled at 2 fps (0.5-second interval); 1 contact sheet(s); no audio stream.

Android screenrecord omits the unchanged tail, so clip duration is shorter than the requested recording window; durations above are probed media durations, not a performance measurement.

## Review boundary

Evidence-only change on the owned QA branch. This supplies Android's four artifacts for #653 alongside its iPhone and iPad portrait comparisons. It is not reviewer approval, a merge, or a replacement for the distinct Dayova product-quality review (DAY-289). Existing draft/visual HOLD remains unchanged.
