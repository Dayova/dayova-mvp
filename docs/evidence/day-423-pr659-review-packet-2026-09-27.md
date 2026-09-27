# DAY-423 / PR #659 — review packet (27 September 2026)

## What changed

The PR classifies learning-plan creation failures and offers a recovery action that fits the known reason. The AI assesses whether the uploaded material supports a knowledge check; a consistent assessment with a concrete missing subject area can produce `insufficient_material`. File access or extraction failures, scheduling constraints, and generation failures use separate codes. Ambiguous AI responses remain `unknown`. Native PDFs and images can still be passed to the model when text extraction does not yield text; failed Office extraction in a mixed set receives a processing reason. Invalid multiple-choice options can fall back to a short-answer question. The reason is stored in the failed generation snapshot and structured diagnostics, so reopening the screen keeps the same recovery choice. Existing inputs and uploaded documents remain in the draft; targeted retry preserves ready sessions, while full regeneration can replace their content. A device run found that the original recovery actions sat below the visible iPhone screen because the failure layout kept the large loading animation; the PR now gives recovery a compact layout and retains the animated layout while work is in progress.

| Reason | Message/action in the changed app |
| --- | --- |
| `insufficient_material` | Explain the specific gap when available; review exam topics, add or replace material, or retry. |
| `material_processing` | Explain the file-processing problem; replace material or retry. |
| `scheduling_constraints` | Adjust learning times. |
| `generation_processing` | Explain the technical failure and offer retry. |
| `unknown` | State that the reason is uncertain; keep inputs and offer material review or retry. |

These are code-path descriptions, not claims that every path has been observed on a device.

## Historical before state

The [original DAY-423 image already published in the PR discussion](https://github.com/Dayova/dayova-mvp/pull/659#issuecomment-5801316298) shows learning-plan creation at 100%, the error “Aus den Unterlagen konnte kein stabiler Start für den Lernplan erstellt werden”, and the actions “Erneut versuchen” and “Lernzeiten anpassen”. It does not offer material editing. The image's exact app build and backend revision are unknown, so this is a historical report, not a controlled base/head run with identical inputs.

![Historical DAY-423 learning-plan error at 100 percent, with retry and learning-time actions](https://raw.githubusercontent.com/Dayova/dayova-mvp/1d9461334808f7d782eee9d595b0249afcb4e0dd/docs/evidence/linear-before-2026-09-23/day-423-ead74cad.jpg)

The image establishes the user-visible failure, but not its backend root cause. The PR adds explicit classification and recovery for several plausible causes; a successful synthetic material test would demonstrate that recovery path without proving which cause produced the original September report.

The same internal Notion report has a 4.70-second video. I inspected its complete visible timeline with nine frames at 0.5-second spacing. At 00:00–00:02 it shows an *Analyse* screen with knowledge-check results; at 00:02.5 the app is being left, and at 00:03–00:04 the iPhone home screen/control center is shown. It does not show learning-plan creation or a recovery attempt, so it is not used as DAY-423 before/after evidence. The audio stream was not transcribed; no conclusion depends on it. The private video is not republished.

## Build and device provenance

The [EAS iOS simulator build `da0996b0-4cc4-4117-be29-3ea4e43615c9`](https://expo.dev/accounts/dayova/projects/dayova/builds/da0996b0-4cc4-4117-be29-3ea4e43615c9) used QA source `694a2925` and an isolated Convex development deployment. Compared with PR feature source `85bebb50`, the QA source adds only an `eas.json` QA build profile. The later PR commit `07295fd7` adds device documentation and a screenshot; it does not change feature code. The build uses a test Clerk key, dummy RevenueCat keys, and no PostHog. It was installed unmodified on local iOS 26.5 simulators.

The Dayova EAS account reports that EAS Simulator is not yet available, so the approved cloud simulator session could not start. Earlier local iOS and Android attempts and their limits are detailed in the [25 September device record](day-423-pr659-device-run-2026-09-25.md).

The first isolated Convex QA deployment later expired. Its `entitlements:getMyAccess` query endpoint returned HTTP 404 for the same probe that returned HTTP 200 on an active development deployment. This is strong evidence for why both old and updated QA apps stopped after login at a blank white auth mask; it is not evidence that the compact layout itself failed. A new isolated deployment (`acrobatic-chameleon-910`, five-day lifetime) was provisioned and the feature backend deployed successfully. Fresh [iOS simulator build `3959d7b9`](https://expo.dev/accounts/dayova/projects/dayova/builds/3959d7b9-92a0-4fb0-8bb9-7dff763b5be4) from QA commit `e94841f7` includes the same feature UI as this PR and points its QA profile to the renewed backend. It built successfully, opened on iPhone 17 / iOS 26.5, and authenticated the disposable account through its test verification code to the trial activation screen. The renewed deployment did not inherit the old trial entitlement.

On 26 September a fresh Android APK [build `0997c1e3-faef-4711-9575-b4f2cbf3c330`](https://expo.dev/accounts/dayova/projects/dayova/builds/0997c1e3-faef-4711-9575-b4f2cbf3c330) **finished successfully** from QA commit `170f9936`. The [APK artifact](https://expo.dev/artifacts/eas/ApbEn9HVW1pkLnuKRIXw5s8LMPUoSVpaSMup_fO1vnM.apk) is available. Relative to the first iOS QA build, that commit adds only [synthetic PDF fixtures and their readable text](day-423-qa/README.md); feature code is unchanged. This is native build evidence, not an Android device run. The two fixture PDFs were downloaded into the local iPhone Files app and visually confirmed in Recents: [insufficient.pdf](day-423-qa/insufficient.pdf) (600 bytes, subject name only) and [linear-functions.pdf](day-423-qa/linear-functions.pdf) (2.41 kB, worked examples and exercises). Neither file contains learner data.

The installed Android tooling was checked with `android-runtime-doctor`: SDK, AVD, and one running Android target were present. That target was already running `com.dayova` and had an older `com.dayova.dev` package with app data. Replacing that package would risk another app state, so it was not overwritten. A second read-only instance of the same AVD was rejected because the first had not been started read-only. A separately created `DAY_423_PR659_QA` AVD could not create its data partition: the emulator required about 7.4 GB while about 5.7 GB were free. On 27 September a fresh `DAY_423_PR659_SMALL_QA` AVD configured with a 2 GB data partition, conservative 2 GB RAM and headless software graphics passed the SDK compatibility checks but still failed before boot: the emulator reported 7.37 GB required and 5.21 GB available. Both disposable AVDs were deleted. None of these attempts loaded the PR app on Android.

## Functional acceptance record

On 27 September, the unmodified iOS QA build `da0996b0` ran on the local iPhone 17 / iOS 26.5 against the isolated development backend. The disposable Clerk account passed email verification and, after the user's explicit confirmation, activated a 14-day test phase with no payment method or automatic renewal. The app's AI disclosure named Google Cloud Vertex AI, and the QA run used synthetic math fixtures and a disposable account. The complete observed sequence was:

1. Enter a mathematics class test for 10 October 2026 and topics including linear functions, slope, intercept, graphs and equations. The app found available study time. Upload only [`insufficient.pdf`](day-423-pr659-ios-insufficient-uploaded-2026-09-27.png), which contains the word “Mathematik” but no explanation or exercise.
2. The AI returned `insufficient_material` with a specific reason: the document contains no subject content, tasks or explanations about linear functions. The [failure screenshot](day-423-pr659-ios-insufficient-error-2026-09-27.png) comes from an independently repeated second QA plan with the same fixture and shows the same classification. The first wording said “das hochgeladene Material”; the second said “das hochgeladene Dokument”. The cause and requested correction were the same.
3. Invoke **Material ergänzen oder ersetzen** from the error. The upload step still listed `insufficient.pdf`; add `linear-functions.pdf` and remove the insufficient file. The [corrected material screen](day-423-pr659-ios-material-corrected-2026-09-27.png) lists the sufficient PDF. Invoke **Weiter** to rerun the analysis.
4. The AI accepted the corrected material and produced a [subject summary and topic list](day-423-pr659-ios-material-assessed-2026-09-27.png) including slope, equations, roots and intersections. Confirming the topics produced a [learning-path preview](day-423-pr659-ios-plan-preview-2026-09-27.png) with a nine-minute knowledge check and a following adaptive block. **Lernweg eintragen** saved the [actual plan](day-423-pr659-ios-plan-saved-2026-09-27.png), with the knowledge check scheduled for 28 September 2026 at 16:00 and the exam on 10 October.
5. A second plan used the same insufficient PDF. From its failure state, **Prüfungsstoff prüfen** returned to the [previously entered topic text](day-423-pr659-ios-topics-retained-2026-09-27.png). This confirms topic retention in that route. We did not independently re-open the first plan's original study-time settings after the correction.

The second run exposed a usability defect in the old QA build: its [error screenshot](day-423-pr659-ios-insufficient-error-2026-09-27.png) shows the specific red message near the bottom while the large loading animation and loading title remain; the recovery buttons are below the visible viewport. Accessibility activation worked, but that does not establish ordinary touch reachability. The local PR worktree now renders a compact failure state. A fresh [iOS simulator build `2cc333c7`](https://expo.dev/accounts/dayova/projects/dayova/builds/2cc333c7-6f1d-4def-8020-a6c3ecbcaf0d) from QA commit `b977635e`, containing the same layout edit, finished successfully. After login with the existing disposable QA account, it showed a blank white screen before reaching the learning-plan flow. Reinstalling the **previous** QA build produced the same blank screen with that account. Removing the QA app and clearing the simulator keychain allowed the previous build to reach login, but after login and test OTP it again showed the blank screen. The expired backend explains this shared result; the current QA build `3959d7b9` passed login against the renewed backend.

The user authorized another activation of the QA test phase for the disposable account. The follow-up local simulator attempt still could not reach the learning-plan flow: concurrent simulator activity and severe host memory pressure (8 GB RAM, about 11 GB swap at peak) reduced free disk space to 118 MB, caused one native install to fail for lack of storage, and made the simulator pasteboard service time out after a later install. The later app reached the welcome and login screens, but no new trial activation or learning-plan operation was completed. The compact layout therefore remains **unverified on device**, and no screenshot is presented as evidence of it. The earlier screenshots establish backend classification and a successful recovery flow in the old build only. This is a host/device-test limit, not an observed failure of the compact failure screen.

The general app issue in which a stalled backend auth shows only a white mask is tracked separately in [DAY-482](https://linear.app/dayova/issue/DAY-482/show-connection-state-when-backend-auth-stalls-after-login) / [draft PR #770](https://github.com/Dayova/dayova-mvp/pull/770). That fix is not part of PR #659.

| Criterion | Observed result | Limit |
| --- | --- | --- |
| Insufficient material | Passed twice on iOS with a concrete AI reason matching the fixture. | Synthetic PDF and isolated backend, not a diagnosis of the historic report. |
| Material correction | Passed on iOS: the failure action returned to upload; adding the sufficient PDF and removing the insufficient one worked. | Old QA build's buttons were initially below the visible viewport. |
| Retained topics and file | Passed in the second run for the topic-review route; the first run still listed the original PDF on return to upload. | Original study-time settings were not separately reopened. |
| Successful continuation | Passed on iOS: topics, plan preview, and saved knowledge-check session were visible. | Only one successful synthetic plan; the knowledge check itself was not executed. |
| Compact recovery layout | Code, TypeScript, Biome, ESLint, a focused recovery UI test, and two native iOS builds pass. The renewed-backend build passed account authentication to the trial screen. | The repeat device run could not complete trial activation and reach the failure screen under host memory/storage pressure; touch reachability remains unverified. |
| Other error reasons and ready sessions | Automated tests and code inspection only. | No device reproduction for processing, scheduling, unknown, or targeted session retry. |
| Android runtime | APK built successfully. | No isolated Android device run. |

The focused recovery UI test passed (2 tests), and TypeScript, Biome, ESLint and `git diff --check` passed after the layout edit. The test checks the recovery actions, not screen geometry. Automated checks and build success do not replace a new-build device observation. The original iPhone 17 simulator app binary, app data, and simulator keychain were restored from the pre-QA backup and byte-compared while shut down. A human reviewer still decides whether the copy and recovery choices match the intended product behavior.

## Product decisions for the reviewer

1. Is it useful to send the learner to **Prüfungsstoff prüfen** and **Material ergänzen oder ersetzen** when the AI identifies a concrete gap, while keeping a direct retry?
2. For an uncertain assessment, is the neutral message and choice of material review or retry preferable to asserting a material problem?
3. Is replacing existing session content during a **full** regeneration acceptable? The PR preserves ready sessions for a targeted retry, but does not promise preservation across complete regeneration.
4. Do the German messages and action labels make the next step clear to a learner without exposing technical implementation details?

The before image establishes the reported pain point. The answers to these product questions require a human decision even if all technical checks pass.

## Review limits

The current CodeRabbit summary on GitHub covers an older feature commit and the subsequent evidence-only commit, rather than a fresh analysis of this packet. Its one inline functional finding about an unschedulable session using the wrong error code was marked addressed in `080adc72`. The PR still requires human review. At the start of this run its branch was 57 commits behind `main`, with `convex/schema.ts` the only file changed on both sides since their merge base. Device results from the QA build should not be presented as proof of an untested future merge result.
