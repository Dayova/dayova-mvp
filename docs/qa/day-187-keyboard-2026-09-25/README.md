# DAY-187 keyboard regression

Base: PR #655, `6dbd96107f8a804e6764b3581d57adbcc03f9a8f`.
Environment: iOS 26.4 simulator `47731F12-CE91-4857-8F3A-799040A0DCA3`, existing development client `de.dayova.app-dev`, light appearance, dedicated Metro port 8091.

## Cause and change

Ordinary React Native inputs did not register their focus with Gorhom. The shared sheet now supplies the keyboard-aware input primitive through context while retaining the shared field styling and normal inputs outside sheets. The component identities are module-level constants; the narrowly documented compiler-lint exception does not introduce components during render.

Both creation dialogs use the existing medium scrollable size: content-height sizing did not account for the complete scrollable dialog and left the cancel action below the visible area.

## Observed regression

On the unmodified base, the exam-type input bounds were `[45,754][357,778]`, below the keyboard top (approximately 535 points). After keyboard registration, the same input was `[45,419][357,443]`. Native accessibility `assertVisible` alone incorrectly passed the original broken layout, so screenshots and geometry are required as well.

Original screenshots are unedited. This is simulator evidence, not physical-device or Android acceptance. Full upload/AI QA remains blocked by the pending replacement of the exposed QA credential.

## Final verification

- Maestro `dialog-comparison.yaml`: passed on the changed source with a freshly restarted Metro bundle. Exam dialog: input, scroll to Cancel, dismissal, enabled Continue, advance to subject selection. Subject dialog: input, close via X, dismissal, enabled Continue. No exam or permanent subject was saved. The initial subject input stage intentionally has no Cancel text button, so the test uses its close control.
- Full Jest suite after keyboard integration: 286 tests / 67 suites passed. Following the final dialog-size and safe-area adjustments: 18 focused tests passed again.
- TypeScript, targeted ESLint/Biome, and `git diff --check`: passed.
- No Android, physical-device notification, enlarged-text or AI-flow acceptance is claimed.
- The final source uses `topInset` to preserve the status-bar safe area when the keyboard expands the sheet.
