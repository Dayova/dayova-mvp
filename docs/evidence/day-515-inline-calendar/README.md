# DAY-515 inline exam calendar validation

Updated on 16 October 2026 with a refreshed Android light-theme capture after the Android-only Continue-label adjustment.

## Scope and native controls

Only the exam branch of `/entry/new?type=exam`, at “Wann findet die Prüfung statt?”, uses the new inline calendar. This includes entry points from Home, “Erste Prüfung planen” on an empty dashboard, and the learning-plans screen. The first-exam action after onboarding opens this same exam flow; it is not a change to onboarding itself.

The homework branch (`type=homework`), onboarding/profile questions and learning-time setup, timetable, notifications, and existing session/preparation editors keep their current controls. `InlineDatePicker` is new and its only production consumer is `ExamDateSelector`; the existing shared `DateTimePickerSheet` is not changed by this PR.

Android uses `DateTimePicker` from `@expo/ui/jetpack-compose`, backed by `androidx.compose.material3.DatePicker`, inside a native `Host`. It retains native Material 3 calendar behavior with Dayova theme colors and light/dark mode. The presentation changes from opening a date dialog to showing the native calendar directly in the exam-date step. iOS retains its native inline date control through `@expo/ui/community/datetime-picker`.

Android's footer button reads “Weiter”: the native calendar already displays the selected date prominently above the grid. iOS keeps the date in its button, for example “Weiter mit 2. November 2026”. Selection, navigation, and date retention are unchanged on both platforms.

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

Captured on a local Android emulator using the `Dayova_PR836` AVD and a development client connected to Metro serving this PR. The light-theme image was refreshed after changing the Android footer label to “Weiter”. A temporary native fixture mounts the unchanged production calendar, progress header, theme, text, and button components; its surrounding layout and footer label follow the exam-date route. It does not mount the authenticated route or call the backend. The entry point was restored and the fixture removed after capture.

- `android-light-selected-date.png`: German app locale, light theme, 2 November 2026 selected; the six-row month, 40% progress, and “Weiter” are visible. The selected date appears in the native calendar header.
- `android-dark-selected-date.png`: historical capture at `d2c8dd4f` of the same selected date and month in dark theme. It still shows the previous date-bearing footer and is not evidence of the final button text. The emulator stalled during the dark recapture attempt; that session was stopped. Only the refreshed light capture is shown as current Android evidence in the PR description.
- During the original capture at `d2c8dd4f`, ADB taps advanced from October to November and selected 2 November; the date and the then-current footer label updated together. The refreshed light capture uses 2 November as fixture state and shows the final “Weiter” label; it is a still image, not a recording of the interaction.
- The floating gear belongs to Expo development tools and is not part of Dayova's product UI.

The 16 October recovery validation recorded 36 UI tests, 7 date/progress unit tests, and TypeScript passing with frozen branch dependencies. After the Android footer-label adjustment, 37 UI tests passed across creation flow, exam controls, and the Android inline picker, along with TypeScript and scoped Biome/ESLint checks. The existing selection/navigation/return test now runs on both iOS and Android and checks their distinct footer labels before and after selection and after returning from topics. The scoped diff was reviewed manually; CodeRabbit CLI review was attempted but rate-limited.

Android native appearance and date-selection behavior have now been inspected in the fixture. Authenticated end-to-end device navigation, maximum text size, tablet layout, and team approval remain outstanding; route navigation and date retention are covered by the existing integration tests rather than these screenshots.
