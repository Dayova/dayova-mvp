# DAY-423 / PR #659 — fixes and verification, 2026-10-07

**Integration follow-up:** `main` later advanced to `ff285aed3dbc7efb0e9fdf4a507123ac1f12c495`, introducing the unscheduled diagnostic/preparation flow. The conflict-resolution follow-up below applies to that integration. The screenshots and native journey in this report still document the explicitly dated `ac83adb9` source, not a fresh native run of the merged flow.

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

## Integration with `main` at `ff285aed`

Resolved conflicts in generated API bindings, AI generation, plan mutations and the generating screen. New drafts now call `prepareDiagnostic` and require no saved learning times or creation-time calendar generation. Stale legacy scheduling metadata does not block that mutation. Legacy drafts with incomplete sessions retain targeted content retry; after material reanalysis clears generation metadata, preparation validates the new questions, transactionally replaces obsolete derived sessions/content/calendar links and preserves plan inputs/documents. New preparation clears failure messages and invalidates old generation claims so an earlier action cannot overwrite it.

Sufficient material must generate exactly ten questions with main's 6,000-token budget; insufficient/uncertain assessments can still return empty arrays. Main's structured-output retry behavior is retained. Incomplete sufficient output retries up to three times and keeps the safe technical-generation code on exhaustion. The header remains at 90% until successful preparation. Both generated and accepted states release native removal protection before deferred review navigation. Stale recovery resets when a fresh generation claim arrives, while query refreshes do not postpone recovery for legacy claims without timestamps. Legacy cleanup uses the same 500-session bound as the plan snapshot and detects overflow before deleting anything. Tests verify rejection preserves all 501 sessions and that a 500-session draft is fully replaced.

Validation after resolution: full Jest **97 suites / 501 tests**, full Vitest **141 files / 1,085 tests** (same explicit Windows runner budget), Node test groups **18 tests**, lint and TypeScript passed. The cleanup/timer follow-up also passed 78 focused backend tests, full Jest, lint, TypeScript and development deployment. The final overflow/recovery follow-up passed 39 focused backend/formatter tests and the full UI suite. Backend regressions exercise replacement of 500 obsolete sessions, rejection before deletion at 501, cleared stale claims and failure messages. Overflow exposes a typed, safe explanation and a new-plan action instead of ineffective retry/material editing, preserving the old draft. Independent Standards and Spec reviews reported zero remaining findings. CodeRabbit CLI findings about incomplete-output retry, stale recovery reset, cleanup limits, overflow and query-refresh timer stability were corrected and covered by regressions. Its final rerun was rate-limited; GitHub CodeRabbit reports that automatic review is paused. CI and OTA outcomes must be evaluated on the latest pushed head.

No new native screenshots are claimed for this follow-up. The current integration is covered by actual-screen automated tests and transactional backend integration tests; a fresh native run of the revised main flow remains a coverage limit.

## Cross-review recovery follow-up, 8 October

The independent review of `20f9cf9d` identified a genuine recovery gap: old sessions caused `clearEmptyContentGeneration` to skip failure persistence, leaving a new claim running and blocking immediate retry. The current creation UI had already switched to atomic diagnostic preparation, but the public `generatePlan` action still used that failure handler on `89a62982`. Replaying the historical mutation harness confirmed the remaining backend behavior.

The public action now uses the existing owner- and generation-guarded `markContentGenerationClaimFailed` handler. Starting generation after material reanalysis clears obsolete derived sessions only for an unaccepted legacy draft with no preparation state or generation stage. Diagnostic preparation and this legacy path share bounded cleanup; plan inputs and documents remain intact. Ordinary same-material partial retries preserve ready sessions.

Two regressions exercise the real public action with current AI consent and a deliberately insufficient study-time budget, so failure occurs before any external model or document request. Both failed before the fix because the plan remained at `content`. They now verify persisted failure reason/message, a second attempt without the 11-minute wait, obsolete-session removal after material correction, retained uploads, ready-session preservation without material correction, and stale-claim protection. The focused backend suite passed 80 tests and the full backend suite passed 141 files / 1,087 tests; lint, TypeScript and development deployment passed. Independent Standards and Spec reviews reported zero actionable findings. The old standalone harness calls a handler the public action no longer uses; these new action-level regressions cover the current failure boundary.
