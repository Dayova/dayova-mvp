# DAY-515 inline exam calendar validation

Captured on 14 October 2026 in a separate iPhone 17 Pro simulator running iOS 26.5.

These are native component previews using the production `ExamDateSelector`, `InlineDatePicker`, theme provider, text, and button components in a temporary scrollable fixture. The surrounding creation header and authenticated route were not part of the fixture. The fixture and temporary entry point were removed after capture.

- `ios-light.png`: light appearance, 14 October 2026 selected; calendar visible immediately, past days disabled, Continue visible.
- `ios-dark-selected-date.png`: dark appearance, 2 November 2026 supplied as the controlled selected date; summary and native selection agree and the six-row calendar fits.

The date values in these screenshots were supplied by the fixture; screenshots are not evidence of a physical tap or route navigation. The available simulator rendered its native calendar labels in English. The wrapper passes `de-DE`, as does the existing sheet picker.

Visual inspection found a native inline host sizing issue on redraw. The iOS wrapper now measures its available width and supplies explicit native dimensions, matching the existing sheet's sizing requirement, with extra height at larger text scales. The light screenshot was recaptured after the explicit-dimension adjustment. The dark screenshot records the appearance preview during that sizing iteration; it is not a separate final-dimensions verification. Maximum text-size and tablet visual inspection remain unverified.

Automated checks passed:

- TypeScript typecheck and scoped Biome/ESLint checks.
- 35 exam-picker and creation-flow UI tests, including selecting a new date, continuing to topics, and returning with the same date.
- Android native-picker adapter test in Europe/Berlin and America/Los_Angeles, covering local date bounds and a selection across the European daylight-saving transition.
- 7 existing date-range and date-picker unit tests.

Android native visual inspection was unavailable because no Android emulator or device was connected. The UI-control service could not interact with the isolated simulator window reliably; native tap behavior is covered at the callback boundary in tests, not by these screenshots.
