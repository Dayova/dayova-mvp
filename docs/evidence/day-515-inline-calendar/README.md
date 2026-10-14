# DAY-515 inline exam calendar validation

Updated on 14 October 2026 using an isolated iPhone 17 Pro simulator running iOS 26.5.

These native previews use the production `LearningPlanCreationProgressHeader`, `ExamDateSelector`, `InlineDatePicker`, theme, text, and button components. The progress header is the existing version on this PR's branch. The authenticated route is not mounted in the temporary fixture; route state and navigation are tested separately. The fixture and temporary entry point are removed after capture.

- Light appearance: 14 October 2026 selected; progress is visible at 40%, the separate date card is absent, and the button reads “Weiter mit 14. Oktober 2026”.
- Dark appearance: 2 November 2026 selected; the progress header remains visible, the six-row calendar fits, and the button reads “Weiter mit 2. November 2026”.

Screenshots were removed from the repository after visual validation. Preview dates were fixture values. Interaction tests verify that a calendar change updates the button, that Continue carries the new date into topics, and that returning preserves it. Screenshots are not evidence of physical taps or authenticated route navigation. The available simulator renders native calendar labels in English; the wrapper passes `de-DE`, as does the existing sheet picker.

Validation for this revision:

- TypeScript and scoped Biome/ESLint checks.
- 35 exam-picker and creation-flow UI tests, including the absence of the date card, the initial/changed Continue labels, preserved date after navigating back, and the unchanged exam-date progress step.
- 3 creation-progress unit tests.
- Previously passed Android adapter tests in Europe/Berlin and America/Los_Angeles and 7 date-range/picker unit tests; picker internals did not change in this revision.

The native inline host uses measured width and explicit height with extra space at larger text scales. Maximum text size, tablet layout, and Android native visuals remain unverified. No Android device is connected, and the available UI-control service could not reliably interact with the isolated simulator window.
