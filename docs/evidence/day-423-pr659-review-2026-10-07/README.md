# DAY-423 / PR #659 — fixes and verification, 2026-10-07

Application source tested: `ac83adb91a5062a05dddd2402a0f16ccec9e4584`, integrated with `main` at `1fadb77b48653e9f163ad8c0ab9cd37fb319340e`. The subsequent evidence commit changes documentation and screenshots only. This report supersedes the current-status claims in the [historical September review packet](../day-423-pr659-review-packet-2026-09-27.md); that packet remains historical evidence.

## Fixes

- Reopened scheduling failures offer retry after learning times are corrected, even when a persisted generation record exists.
- Safe backend messages, including the affected document filename, survive formatting and persisted generation failures. Success and new attempts clear stale failure messages.
- Retry has a synchronous in-flight gate and accessible busy state. Targeted retries retain ready sessions.
- The creation header stays at 90% while generation is incomplete or failed. Native navigation releases the back guard before replacing a completed generating route with review.
- Document downloads have a 30-second timeout, classified as a material-processing failure with the filename. Failure reasons share one backend validator and type.

## Automated verification

| Check | Result |
| --- | --- |
| `pnpm check` (Biome, ESLint, TypeScript) | Passed |
| `pnpm test:ui` | 90 suites, 454 tests passed |
| `pnpm exec vitest run --maxWorkers=1 --testTimeout=30000` | 137 files, 974 tests passed |
| Node test commands for Metro, Android autolinking and skill catalogs | 18 tests passed |
| `git diff --check` | Passed |
| Convex development deployment | Passed |
| Independent Standards review | 0 actionable findings |
| Independent Spec review against DAY-423 | 0 actionable findings |
| CodeRabbit CLI committed review against integrated `main` | 0 findings |

The Windows full Vitest runs twice hit the default five-second budget only in subprocess-based Expo configuration checks. Those checks passed on a focused default-budget rerun (30 tests); the complete suite passed with the explicit 30-second runner budget above. No tests were skipped and no repository timeout configuration was changed.

Nine generating-screen tests cover reopened scheduling retry, existing-session targeted retry, filename recovery, rapid repeated activation, busy accessibility, incomplete/ready header progress, and releasing navigation protection before the deferred review transition. Backend regressions cover persisted safe messages, stale-message clearing and download timeout classification.

## Native Android verification

Android 16 / API 36 x86_64 emulator, 1080×2400, density 420. Current application JavaScript ran through Metro in the existing `com.dayova.dev` development client. The client APK was reused from the PR #836 development build; its SHA-256 was `BF286F35576B7CAED1BFABB10AFEA40D4FD7F355BD83BD5A3E4CD4D6F7C2423A`. This is a current-source development-client run, not a new PR #659 release APK.

Used a synthetic Clerk development account, development trial and configured Convex development deployment. Initial exam/draft and fixed 30-minute workload were prepared through authenticated public mutations to focus the recovery checks. Uploads, replacement/removal, consent, topic return, scope confirmation, learning-time entry, retry and acceptance used actual native controls and actual backend actions. No AI responses were mocked. Analytics were disabled; the screenshots retain the development tools gear and occasional LogBox footer. Its overlay was dismissed before interacting with covered controls.

| Journey | Observed result | Evidence |
| --- | --- | --- |
| Insufficient PDF | Specific lack of content; all three recovery actions visible without scrolling | [insufficient-material.png](insufficient-material.png) |
| Return to topics | Original entered topic text retained | [topics-retained.png](topics-retained.png) |
| Replace insufficient PDF | Existing upload retained until removed; corrected PDF produced six scope topics and knowledge questions | [corrected-material.png](corrected-material.png) |
| No learning times, then correct and reopen | Persisted scheduling failure, 90% header, learning-time and retry actions; native Monday 17:00–17:30 entry; retry produced ready content | [scheduling-reopened.png](scheduling-reopened.png) |
| Corrupt DOCX | Actual extraction failure identifies `pr659-corrupt.docx`; replacement and retry actions visible | [filename-error.png](filename-error.png) |
| Replace corrupt DOCX and generate | Correct PDF analysis succeeded; confirming scope generated two scheduled sessions, one ready committed content session, zero failed sessions, stage `ready`; automatically reached review without restart or forced review navigation | [automatic-review.png](automatic-review.png) |
| Accept corrected plan | Native acceptance navigated to the saved plan; backend status `accepted` | [accepted-plan.png](accepted-plan.png) |

The ready-plan reopening path was also verified after a Metro/app restart. All screenshots were visually inspected; final route and backend status were independently read through the authenticated app client. UIAutomator can fail to produce a fresh hierarchy while an animation is active, so route/backend state and actual screenshots were used to verify completion rather than a stale hierarchy.

After capture, both synthetic plans, their managed documents/session data and the synthetic exam were removed with authenticated public mutations; both plan snapshots returned null. The synthetic development account and its trial/learning-time settings remain in the test instance. No credentials or tokens are included here.

## Remaining limits

- No fresh iOS or physical-device run of the October fixes; September iOS evidence applies to its dated source/build only.
- A real stalled remote download was not induced on a device; timeout classification is covered by automated tests.
- Synthetic materials establish recovery behavior, not the historical report's original cause or classification accuracy for every real document.
- Full regeneration can replace existing session content; preservation is guaranteed by the targeted retry path, not full regeneration.
- Fresh CI/OTA assessment and required human approval must be evaluated on the pushed PR head. Local green checks do not substitute for them.
