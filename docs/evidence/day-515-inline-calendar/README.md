# DAY-515 inline exam calendar validation

Updated on 16 October 2026 with Android evidence for source commit `d2c8dd4f`.

## Scope and native controls

Only the exam branch of `/entry/new?type=exam`, at “Wann findet die Prüfung statt?”, uses the new inline calendar. This includes entry points from Home, “Erste Prüfung planen” on an empty dashboard, and the learning-plans screen. The first-exam action after onboarding opens this same exam flow; it is not a change to onboarding itself.

The homework branch (`type=homework`), onboarding/profile questions and learning-time setup, timetable, notifications, and existing session/preparation editors keep their current controls. `InlineDatePicker` is new and its only production consumer is `ExamDateSelector`; the existing shared `DateTimePickerSheet` is not changed by this PR.

Android uses `DateTimePicker` from `@expo/ui/jetpack-compose`, backed by `androidx.compose.material3.DatePicker`, inside a native `Host`. It retains native Material 3 calendar behavior with Dayova theme colors and light/dark mode. The presentation changes from opening a date dialog to showing the native calendar directly in the exam-date step. iOS retains its native inline date control through `@expo/ui/community/datetime-picker`.

## iOS captures — 14 October 2026

Captured using an isolated iPhone 17 Pro simulator running iOS 26.5.

These native previews use the production `LearningPlanCreationProgressHeader`, `ExamDateSelector`, `InlineDatePicker`, theme, text, and button components. The progress header is the existing version on this PR's branch. The authenticated route is not mounted in the temporary fixture; route state and navigation are tested separately. The fixture and temporary entry point are removed after capture.

- `ios-light.png`: 14 October 2026 selected; progress is visible at 40%, the separate date card is absent, and the button reads “Weiter mit 14. Oktober 2026”.
- `ios-dark-selected-date.png`: 2 November 2026 selected; the progress header remains visible, the six-row calendar fits, and the button reads “Weiter mit 2. November 2026”.

Dates in the screenshots are fixture values. Interaction tests verify that a calendar change updates the button, that Continue carries the new date into topics, and that returning preserves it. Screenshots are not evidence of physical taps or authenticated route navigation. The available simulator renders native calendar labels in English; the wrapper passes `de-DE`, as does the existing sheet picker.

Validation for this revision:

- TypeScript and scoped Biome/ESLint checks.
- 35 exam-picker and creation-flow UI tests, including the absence of the date card, the initial/changed Continue labels, preserved date after navigating back, and the unchanged exam-date progress step.
- 3 creation-progress unit tests.
- Previously passed Android adapter tests in Europe/Berlin and America/Los_Angeles and 7 date-range/picker unit tests; picker internals did not change in this revision.

The iOS native inline host uses measured width and explicit height with extra space at larger text scales.

## Android captures — 16 October 2026

Captured on a local Android emulator using the `Dayova_PR836` AVD and a development client connected to Metro serving this PR at `d2c8dd4f`. A temporary native fixture mounts the unchanged production calendar, progress header, theme, text, and button components; its surrounding layout follows the exam-date route. It does not mount the authenticated route or call the backend. The entry point was restored and the fixture removed after capture.

- `android-light-selected-date.png`: German app locale, light theme, 2 November 2026 selected; the six-row month, 40% progress, and “Weiter mit 2. November 2026” are visible.
- `android-dark-selected-date.png`: the same selected date and month in dark theme.
- In the live fixture, ADB taps advanced from October to November and selected 2 November. The calendar selection and Continue label updated together. The final captures also use that date as fixture state; they are still images, not recordings of the interaction.
- The floating gear belongs to Expo development tools and is not part of Dayova's product UI.

The 16 October recovery validation recorded 36 UI tests, 7 date/progress unit tests, and TypeScript passing with frozen branch dependencies. This evidence/description-only update does not change runtime code or rerun those suites.

Android native appearance and date-selection behavior have now been inspected in the fixture. Authenticated end-to-end device navigation, maximum text size, tablet layout, and team approval remain outstanding; route navigation and date retention are covered by the existing integration tests rather than these screenshots.
