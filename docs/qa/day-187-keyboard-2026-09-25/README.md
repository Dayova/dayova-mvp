# DAY-187 keyboard regression

## Current native replay — 29 September 2026

Source: PR #655 implementation at `4d3a251062f446bf54524a2daade484638f5c82b`. The current implementation uses dynamic sheet sizing. The two dialogs now end after their content and the intentional bottom safe-area spacing instead of retaining the historical fixed-medium empty area.

Environment: iOS 26.4 simulator `47731F12-CE91-4857-8F3A-799040A0DCA3`, development client `de.dayova.app-dev`, light appearance, dedicated Metro port 8091 and an isolated local Convex deployment. Synthetic text was entered only; no exam or permanent subject was saved.

| Exam type, current dynamic sheet | Subject, current dynamic sheet |
| --- | --- |
| <a href="current-ios-exam-keyboard.png"><img src="current-ios-exam-keyboard.png" width="220" alt="Current iOS exam-type dialog sized to its content above the keyboard" /></a> | <a href="current-ios-subject-keyboard.png"><img src="current-ios-subject-keyboard.png" width="220" alt="Current iOS subject dialog sized to its content above the keyboard" /></a> |

The original 1206 × 2622 PNGs are unedited and open at full resolution when clicked. The updated `dialog-comparison.yaml` replay passed from the learning-plan entry point through both dialogs. This is exact-head iOS simulator evidence; Android was not recaptured because no Android emulator is available in the local test environment. The Android images farther below remain explicitly historical evidence.

## Final owner review captures — 29 September 2026

These five unedited 1206 × 2622 originals were supplied from the `Dayova Jakob Review iPhone` simulator review. The 180px previews keep the pull request readable and open the originals at full resolution when clicked.

| State | Exam type | Subject |
| --- | --- | --- |
| Dynamically sized sheet | <a href="final-review-exam-sheet.png"><img src="final-review-exam-sheet.png" width="180" alt="Owner review of the dynamically sized exam-type sheet" /></a> | <a href="final-review-subject-sheet.png"><img src="final-review-subject-sheet.png" width="180" alt="Owner review of the dynamically sized subject sheet" /></a> |
| Input focused with iOS keyboard | <a href="final-review-exam-keyboard.png"><img src="final-review-exam-keyboard.png" width="180" alt="Owner review of the exam-type screen with the iOS keyboard visible" /></a> | <a href="final-review-subject-keyboard.png"><img src="final-review-subject-keyboard.png" width="180" alt="Owner review of the subject sheet with the iOS keyboard visible" /></a> |

The review also exposed a separate visual follow-up in the newer shared selection control: the selected exam type showed a black check on the cyan indicator. This capture is evidence of that pre-fix state, not an after-image. The exam-specific check color was changed to white and regression-tested on PR #694 in commit `b4b2b903`.

<a href="follow-up-exam-check-black.png"><img src="follow-up-exam-check-black.png" width="180" alt="Pre-fix owner review showing a black check on the selected cyan exam-type indicator" /></a>

## Current integration status — 26 September 2026

Commit `53a3638d` integrates `main` at `165e1da1` and resolves the PR's merge conflicts. Main's dynamic sheet sizing, footer handling, accessibility behavior and navigation guards are retained; the keyboard-aware input provider and top safe-area inset are retained from this PR. Obsolete fixed-size props were removed from the subject and exam-type dialogs.

Validation on this integration: 907 Vitest tests and 306 Jest tests (71 suites) passed; TypeScript, targeted ESLint and diff checks passed. The historical screenshots below document their explicitly identified earlier sources. The current-head iOS replay above now documents the merged dynamic-sizing implementation; physical-device acceptance remains separate.

## Historical native verification

Base: PR #655, `6dbd96107f8a804e6764b3581d57adbcc03f9a8f`.
Environment: iOS 26.4 simulator `47731F12-CE91-4857-8F3A-799040A0DCA3`, existing development client `de.dayova.app-dev`, light appearance, dedicated Metro port 8091.

## Cause and change

Ordinary React Native inputs did not register their focus with Gorhom. The shared sheet now supplies the keyboard-aware input primitive through context while retaining the shared field styling and normal inputs outside sheets. The component identities are module-level constants; the narrowly documented compiler-lint exception does not introduce components during render.

At the historical verification source, both creation dialogs used the existing medium scrollable size: content-height sizing did not account for the complete scrollable dialog and left the cancel action below the visible area. The current-head replay above supersedes that fixed-size presentation.

## Observed regression

On the unmodified base, the exam-type input bounds were `[45,754][357,778]`, below the keyboard top (approximately 535 points). After keyboard registration, the same input was `[45,419][357,443]`. Native accessibility `assertVisible` alone incorrectly passed the original broken layout, so screenshots and geometry are required as well.

Original screenshots are unedited. This is simulator evidence, not physical-device acceptance. Full upload/AI QA is separate; a minimal Vertex connectivity probe passed after the owner authorized continued use of the existing QA credential. The credential exposure remains unresolved.

## Final verification

- Maestro `dialog-comparison.yaml`: passed on the changed source with a freshly restarted Metro bundle. Exam dialog: input, scroll to Cancel, dismissal, enabled Continue, advance to subject selection. Subject dialog: input, close via X, dismissal, enabled Continue. No exam or permanent subject was saved. The initial subject input stage intentionally has no Cancel text button, so the test uses its close control.
- Full Jest suite after keyboard integration: 286 tests / 67 suites passed. Following the final dialog-size and safe-area adjustments: 18 focused tests passed again.
- TypeScript, targeted ESLint/Biome, and `git diff --check`: passed.
- No physical-device notification, enlarged-text or AI-flow acceptance is claimed.
- The final source uses `topInset` to preserve the status-bar safe area when the keyboard expands the sheet.

## Android verification — 25 September 2026

Source: `2fc14c8fa7a23e92bbeb152046c7c4fde0da564b`, dedicated Metro 8091, existing `com.dayova.dev` client, Android 16 / API 36 emulator, dark appearance, existing QA account. No backend deployment.

- Standard Gboard was displayed after disabling emulator stylus handwriting temporarily. Both fields and the exam Cancel action are above the keyboard in the original screenshots below.
- Exam: typed synthetic text, cancelled, retained enabled Continue, advanced to subject selection.
- Subject: typed synthetic text. The first close attempt hit the overlapping development-menu launcher, so the full run's final assertion failed. After dismissing that launcher, a separate close replay passed: dialog absent and Continue enabled. This is a qualified replay, not an uninterrupted full-run pass.
- Earlier runs with only a narrow handwriting toolbar passed functional assertions but are not evidence of full-keyboard geometry.
- No custom subject or exam was saved by these dialog checks. Physical devices, light appearance and enlarged text are not covered by this Android run.

| Exam type, standard keyboard | Subject, standard keyboard |
| --- | --- |
| <a href="android-exam-keyboard.png"><img src="android-exam-keyboard.png" width="180" alt="Android exam type input and Cancel above Gboard" /></a> | <a href="android-subject-keyboard.png"><img src="android-subject-keyboard.png" width="180" alt="Android subject input and Continue above Gboard" /></a> |

The PNG originals are unedited and open at full resolution when clicked. `android-dialog-comparison.yaml` records the main test flow.
