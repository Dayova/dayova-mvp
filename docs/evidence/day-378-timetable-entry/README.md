# DAY-378: Timetable import entry

Implements the user-selected option 2: one Dayova-gradient import action, a short source hint, and a full-width neutral manual-entry button. Camera and files are equal choices inside the existing ActionSheet. No new button appearance is introduced.

Issue: [DAY-378](https://linear.app/dayova/issue/DAY-378/clarify-timetable-entry-with-one-import-action-and-a-secondary-manual).

## Native evidence — 8 September 2026

The actual `src/app/timetable/index.tsx`, `TimetableEntry`, shared buttons, native ActionSheet, fonts, scrolling and theme tokens were rendered on a local Pixel 6 x86_64 emulator (Android API 37.0, 1080×2400, density 420). A temporary entry point supplied native safe-area, keyboard and sheet providers. Resolver fixtures replaced authentication, Convex calls and routing; no live backend or account data was changed. Theme fixtures selected the real light/dark color mirrors from system appearance, with the real NativeWind dark variables applied at the root.

The source picker remained real: selecting **Dateien** opened Android's DocumentsUI (Recent / No items); Android Back returned to the entry. Screenshots are still evidence, not a recording or proof of precise animation timing. The dismissal boundary and duplicate-consumption behavior are covered by the UI tests.

| Case | Evidence | Observation |
| --- | --- | --- |
| Light, font scale 1.0 | [Entry](android-light.png) | Both actions are 147 physical px / 56 dp tall and fit above the bottom system inset. |
| Light source sheet | [Sheet](android-sheet-light.png) | Scannen and Dateien are equal tiles; title, explanation and close control fit. |
| Dark, font scale 1.0 | [Entry](android-dark.png) | Neutral action becomes white with dark content, using the existing theme contract. |
| Dark, font scale 2.0 | [Scrolled entry](android-large-scrolled.png) | Both labels wrap fully. The manual button is reachable at bounds [53,1828][1028,2082], above the bottom system area. |
| Dark source sheet, font scale 2.0 | [Sheet](android-large-sheet.png) | Sources become full-width rows and remain fully visible. |

The development-client gear belongs to simulator tooling. The original font scale 1.0 and light system appearance were restored. Temporary entry/resolver changes were restored; the emulator and task-owned Metro server were stopped after inspection.

## Automated and code review coverage

- Focused React Native UI tests cover the two entry actions, hidden sources until opening, source dispatch after native dismissal, repeated dismissal consuming a selection once, no-op close/reopen, pending picker busy state, permission denial recovery, direct manual draft creation without AI consent, loading/auth/processing disabling, and source-row reflow.
- Existing timetable-week-editor UI tests still pass.
- The focused UI suites pass all 14 tests; the timetable-editor unit suite passes all 4 tests.
- `pnpm check` covers Biome, ESLint and TypeScript.
- CodeRabbit reviewed the scoped implementation twice, including the final loading-state adjustment and evidence: both passes completed with no findings.

## Limits

No native iOS simulator was available on this Windows host. VoiceOver/TalkBack, a complete signed-in journey, actual image extraction and production network failure handling were not exercised end to end. The existing white-on-cyan gradient contrast remains a pre-existing shared design-system limitation; this change deliberately retains the approved palette. The existing timetable activation and reimport data behavior is preserved, with reimport visually subordinate in the editor.
