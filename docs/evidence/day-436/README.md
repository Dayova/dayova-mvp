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

## Pending native evidence / review gate

The PR stays draft. Philipp will supply the after screenshots. The handbook also requires before and after screen recordings and manual iOS/Android checks. No simulator, Android-device or physical-device interaction pass is claimed by the automated checks or export.

Capture and check:

1. Heute: exactly three tabs; no timetable prompt for a new user, a draft import or an active timetable; no imported school lessons or inflated appointment counts.
2. Einstellungen: no timetable row; Lernzeiten, support and account settings still work.
3. Existing `/analyse`, `/analyse/wissensstand`, `/analyse/lernhuerde`, `/analyse/naechster-schritt`, `/analyse/development` and `/timetable` links safely return to Pläne/Heute.
4. Create/open a homework item and an exam; create a learning plan, open a session, complete practice/diagnostic/rehearsal and return to its plan. Theory completion remains unchanged.
5. Back navigation, light/dark appearance and large text on iOS and Android.

Attach the after screenshot and both recordings directly in the PR before marking it ready. Final merge/release remains with Jakob or Fabius.
