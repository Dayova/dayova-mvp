# DAY-423 / PR #659 — final integrated Android verification, 8 October 2026

**Later source follow-up:** two late GitHub review findings were confirmed and fixed in `9dd2f89d`: duplicate normalized multiple-choice options fall back to short text before diagnostic storage; legacy scheduling failures invoke full generation instead of content-only retry, including after a transient retry error. Regressions failed before the fixes and passed afterward. Full validation passed 1,090 Vitest tests, 503 UI tests, lint and TypeScript; the development deployment succeeded. The CodeRabbit CLI review of the core four-file fix found zero findings, and independent Standards/Spec reviews found no actionable issues. The original six screenshots below still document `2972612b`.

Application source tested: `2972612b5c5e21a63885040f62c6cca2fc4ea34e`, integrated with `main` at `dc59a02bdb481b306a0f42854b5b27531d893b25`. The subsequent evidence commit changes documentation and screenshots only. This run closes the fresh-native coverage gap recorded in the [7 October report](../day-423-pr659-review-2026-10-07/README.md); that report's screenshots retain their original provenance.

## Environment and method

Android emulator `Dayova_PR836`, Android 16 / API 36, x86_64, 1080 × 2400, density 420. Current JavaScript was served by Metro to the existing `com.dayova.dev` development client, not a newly built release APK. The client APK SHA-256 is `BF286F35576B7CAED1BFABB10AFEA40D4FD7F355BD83BD5A3E4CD4D6F7C2423A`.

The app used the configured Convex development deployment and a signed-in synthetic Clerk test account. Authenticated public mutations created one isolated exam/draft and temporarily removed that account's saved learning time. Uploads, return to topics, document removal/replacement, analysis, scope confirmation and acceptance used actual native controls. Live document processing and model responses were used; no AI responses were mocked. Backend state was independently read through the authenticated app client. The developer-tools gear is visible; development LogBox notifications were dismissed before capture and before interacting with covered controls. Analytics were disabled for the run.

Host observation window: approximately 00:29–00:34 Europe/Berlin on 8 October (22:29–22:34 UTC on 7 October). The emulator's status-bar clock is virtual-device time and is not the host timestamp. The initial launch required changing Metro's localhost binding so ADB forwarding could connect; this was a local test setup correction.

## Observations

| Journey | Native and backend result | Evidence |
| --- | --- | --- |
| Insufficient PDF | Specific lack-of-content explanation; all three recovery actions visible without scrolling | [insufficient-material.png](insufficient-material.png) |
| Return to topics | Original entered topic text retained | [topics-retained.png](topics-retained.png) |
| Replace with corrupt DOCX | Actual document-processing failure identifies `pr659-final-corrupt.docx`; replacement and retry actions visible | [filename-error.png](filename-error.png) |
| Replace with sufficient PDF | Analysis succeeds: six topics, exactly ten knowledge questions; scope screen at 90% | [corrected-material.png](corrected-material.png) |
| Confirm scope with no saved learning times | `prepareDiagnostic` succeeds; plan `generated`, preparation state `diagnostic`, generation `ready`, one ready session, zero failed sessions, learning-time count zero; automatically reaches review without restart or forced review navigation | [automatic-review.png](automatic-review.png) |
| Accept with “Jetzt starten” | Plan `accepted`; automatically opens the diagnostic session at question 1 of 10; native answer field and action buttons visible with the keyboard | [accepted-diagnostic.png](accepted-diagnostic.png) |

No app restart was used between the two failure recoveries and the successful diagnostic acceptance. Returning to the material step retained the existing upload until its explicit native removal. The initial fixture navigation opened the material step only; subsequent recovery and successful navigation used the app's own controls and route transitions.

After capture, the synthetic plan, its managed documents/session data and synthetic exam were removed through authenticated public mutations. The plan snapshot returned null. The test account's original Monday 17:00–17:30 learning time was restored and checked for the same values. Cleanup needed an authenticated token refresh after deletion; the completed user journey preceded this cleanup step. No credentials or tokens are included in this evidence.

## Repeat Android run after the late fixes

Application source `9dd2f89de498ad28921b399b10d5008c73a6766b`, same development client and development backend. Around 00:50–00:52 Europe/Berlin, a fresh synthetic draft with zero saved learning times used native PDF upload and live analysis, yielding six topics and exactly ten questions. Native scope confirmation prepared one ready diagnostic session with zero failed sessions and automatically navigated to review. Native “Jetzt starten” accepted the plan and opened question 1 of 10 with the keyboard and both action buttons visible. No review navigation was forced.

- [Automatic review on the late-fix source](late-fix-automatic-review.png)
- [Accepted diagnostic on the late-fix source](late-fix-accepted-diagnostic.png)

The emulator displayed a System UI stall during startup; reconnecting the app after boot resolved it before the fixture journey. The later source fixes are also covered by the duplicate-choice/storage-validator and actual-screen legacy-rescheduling regressions. This repeat establishes the integrated success path after those fixes; it does not claim a native reproduction of duplicate model choices or legacy rescheduling.

The repeat fixture's plan, managed documents/session data and exam were removed. After waiting for the test client's refreshed authentication to settle, the plan snapshot returned null and the original learning-time values were confirmed restored.

## Merge evidence and limits

At application head `2972612b`, required CI, native fingerprints, OTA gates and the fresh OTA-report check passed; the Expo report identified that exact full SHA as OTA-compatible. GitHub reported no merge conflicts and required a human approval. Local validation passed 1,087 Vitest tests, 501 UI tests, 18 Node tests, lint and TypeScript. Independent Standards and Spec reviews reported no actionable findings. The fresh CodeRabbit CLI review reported no code findings and one minor date/provenance note, subsequently clarified as a later addendum; GitHub automatic CodeRabbit reviews were paused.

This run verifies Android recovery, diagnostic preparation, automatic review navigation and acceptance on the integrated source. It does not cover completion of all ten diagnostic questions or subsequent study-plan scheduling. No fresh iOS or physical-device run of the October integration was performed. A real stalled download was not induced natively; timeout classification remains covered by automated tests. Synthetic materials establish the tested recovery behavior, not classification accuracy for every real document. Any later source changes require renewed checks.
