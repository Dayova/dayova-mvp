# DAY-436: focus the app on learning

[Linear issue](https://linear.app/dayova/issue/DAY-436) · [Developer handbook](https://app.notion.com/p/3dc2e87228bf815e890fc5f1397c4940)

## Change

The native tabs are Heute, Pläne and Einstellungen (gear icon). The timetable entry and setup prompt are removed. Imported timetable lessons are filtered before dashboard counts, daily lists and highlights are derived. Homework, exams, learning sessions and their existing creation actions remain available.

Old `/analyse` URLs (including detail screens) redirect to Pläne. `/timetable` redirects to Heute. The feature implementations and stored data are retained for later validation. Practice, diagnostic and rehearsal completion returns to the current learning plan, with Pläne as fallback. Internal learning assessment and validation telemetry remain intact.

## Before evidence

Philipp supplied these original iPhone screenshots on 18 September 2026:

- [Heute](before-home.PNG): four tabs and the “Stundenplan fertigstellen” prompt.
- [Analyse](before-analysis.PNG): analysis screen and four tabs.

These images show Philipp’s existing integrated development build, **not a verified capture of the PR base**. Their exact capture commit is unknown. The independent PR base is `3a95cd02c0773d86813372eee876ff6545f151be` (`main`).

## Validation

- `pnpm check`: passes (Biome, ESLint, TypeScript).
- Unit suite: 116 files, 750 tests passed. Metro watcher/cache, Android autolinking and skill-catalog script suites also passed outside the filesystem sandbox.
- Full Jest UI suite after updating the retired settings-button expectation: 65 suites, 271 tests passed. Includes navigation/redirects, completion actions and settings coverage.
- iOS and Android Hermes export: passed with `APP_VARIANT=development expo export --platform all`.
- Every changed TypeScript/TSX file passes Biome; `git diff --check` passes.
- Full `pnpm format:check` remains blocked by three unchanged files already present on the base: `scripts/publish-production-ota.mjs`, `src/components/ui/dayova-sheet-frame.tsx`, and `src/features/learning-plans/use-prepare-session-content.ui.test.tsx`. Their working-tree contents match the base exactly. They are outside this PR.

## iPhone handoff

The same behavior was applied to Philipp’s existing, already-running `dayova-mvp` development checkout, preserving its unrelated changes. That checkout includes unmerged personal-subject work; timetable wording was also removed from its subject screens. Those unmerged subject screens are not part of this independent PR.

The connected device is an iPhone 16 with development app `de.dayova.app-dev`, version 1.0.4 (1), served by Metro on port 8081. The iOS development bundle returned HTTP 200. A reload was requested through Metro. This is a development-client handoff, not a TestFlight, production OTA or backend deployment.

## After evidence and physical-device checks — 18 September 2026

Original PNG captures taken directly from Philipp’s connected iPhone 16 with `devicectl device capture screenshot`; iOS 27.0 (24A437), development app `de.dayova.app-dev` 1.0.4 (1). They show the integrated development checkout with DAY-436 code from `958a31f1b5af4270f27bea9c1203cd83df30443d`, not an isolated installation of this PR.

- [Heute](after-home.png), 12:03 CEST: exactly three tabs, Einstellungen gear icon, next learning step still present, timetable setup card absent, daily count visible.
- [Einstellungen](after-settings.png), 12:05 CEST: Lernzeiten and the integrated checkout’s existing personal-subject row remain; no timetable row. The personal-subject feature is from separate unmerged work.

Both images were visually inspected. The floating “Tools” gear is development tooling, separate from the app’s Einstellungen tab. An initial stuck development “Refreshing” banner was cleared by restarting the app; intermediate captures containing that banner were excluded. Screen capture created unmodified original PNGs.

The required GitHub CI (lint, typecheck, tests) passed on the implementation commit. This follow-up changes evidence only.

## Review handoff and remaining merge checks

Philipp explicitly requested screenshots and release of the issue for Jakob’s review. The PR is handed over for that review; this is not a claim that all native acceptance criteria or merge requirements are complete.

- Before and after screenshots are attached directly in the PR.
- Before and after screen recordings are still missing. `devicectl device capture screen-record` returned CoreDevice error 1001: **“The capability ‘Screen Recording’ is not supported by this device.”** No recording was created; no video was fabricated from still images.
- No Android device/emulator was available in this session. Android export passed, but manual Android checks remain open.
- End-to-end creation/completion, large text, dark mode and comprehensive saved-link/back-navigation checks remain open. Limited screenshot checks do not establish those behaviors.

Before merge, complete these checks on iOS and Android:

1. New user, draft import and active timetable: no prompt or imported school lessons; correct counts.
2. All old analysis and timetable URLs return to Pläne/Heute without a dead end.
3. Create/open homework and exams; create a learning plan and complete practice/diagnostic/rehearsal, returning to its plan. Theory completion remains unchanged.
4. Back navigation, light/dark appearance and large text.
5. Attach the required before/after recordings through a supported recording method.

Final acceptance, merge and release remain with Jakob or Fabius.
