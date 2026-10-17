# Topic and inline hint search — 18 October 2026

[DAY-530](https://linear.app/dayova/issue/DAY-530) is implemented directly in
[PR #884](https://github.com/Dayova/dayova-mvp/pull/884). The temporary stacked
PR #899 is closed. Product revision: `30c8046000053e6cd09712f3a3d2d9c7028a25da`.

The reference layout uses neutral removable topic chips below search,
transparent plus/check suggestion rows, visible subject metadata, and a custom
term action below suggestions. Jakob's subject-aware WLO matching, cache and
backend remain unchanged. Optional exam hints stay inline and support filtering,
multiple explicit additions, custom text and subsequent free editing. The
pre-existing internal placement-comparison switch remains test-only.

## Uploaded evidence

All six original files were uploaded through `gh api` to the dedicated archive
branch `codex/pr-884-evidence-2026-10-18`; do not merge that branch into app source.
[Archive and capture notes](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/README.md).
[Stable URLs, sizes and SHA-256](topic-hint-layout-assets.json).
[PR gallery with embedded screenshots and recordings](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6241996755).
No media binaries or capture entry changes are included in the product branch.

| View | Before | After |
| --- | --- | --- |
| Topic search | [PNG](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/before-topics.png) | [PNG](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/after-topics.png) |
| Exam hints | [PNG](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/before-hints.png) | [PNG](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/after-hints.png) |
| Recording | [MP4, 50.77 seconds](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/before.mp4) | [MP4, 52.88 seconds](https://github.com/Dayova/dayova-mvp/blob/1c929959c355fad4d2fa9ffaa701687a78e9f803/after.mp4) |

Before is the previous #884 head `a58b0d7953d11f7394750be47ede3b93908df3b9`,
not the PR integration base on main. This is incremental follow-up evidence;
older PR galleries retain their own revision coverage. Before/after hint
screenshots have different selected-topic counts, so they demonstrate each
editor state rather than identical starting conditions.

## Environment and limitations

Captured 17–18 October 2026 in an iPhone 17 Pro simulator running iOS 26.5,
dark appearance, installed Dayova development client. Actual RequiredTopicsStep,
TopicSearch and ExamHintsEditor components with shared fonts, controls and theme
providers. Synthetic Deutsch/Gedichtanalyse state and two controlled Rhetor
results. No live WLO calls, authenticated full route or database save/reopen.
The fixture footer/switches and floating development control are capture tools.
The fixture's scroll can overlap the status bar; this is not route acceptance.

The before video includes transient simulator scaling/black-area artifacts
around 32–44 seconds. The after video includes an iOS clipboard permission dialog
around 26–28 seconds. Its custom entry is exactly “Nur Kapitel”. Raw recordings
are retained without retouching, synthesized frames or audio.

## Video inspection

The inspect-video-evidence workflow sampled both complete timelines. All eight
contact sheets and individual frames around selection and hint additions were
inspected. One-second sampling cannot exclude brief events between samples.

- Before 13–20s: Rhetor and the original checkbox cards.
- Before 21–31s: Rhetorische Mittel selected; two chips visible.
- Before 46s: cleared query retains topic selections; 50s: first hint appended.
- After 6–9s: Text filters the hint suggestions; 10s: adding Textbelege clears
  the query and restores available suggestions.
- After 18s: second hint appended without replacing the first.
- After 19–25s: custom query preserves existing lines; 45–52s: custom addition
  leaves three lines with an empty hint search.

Coverage: 50.77-second video; 51 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

Coverage: 52.88-second video; 53 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

## Guidelines and remaining acceptance

Consulted [03 — Evidence, Review & Merge Checklist](https://app.notion.com/p/3dc2e87228bf81c69e43cadf318c2d9f).
The four evidence types are present. The user explicitly requested repository
uploads through GitHub CLI, so these use an archive branch and PR links rather
than native GitHub comment attachments. The incremental baseline is explicitly
identified instead of presenting it as main. These are documented limitations
of guideline compliance; the PR remains draft.

Current-update Android, physical iPhone, VoiceOver/TalkBack, large text, light
appearance and full signed-in save/reopen acceptance remain open. Existing
TestFlight 1.0.7 (78) contains a58b0d79, not this update; no replacement package
or deployment is claimed. Prior student validation remains separate in DAY-517.

## Validation

- Product-head CI for 30c80460 passed quality, native fingerprints, production
  OTA gates and report freshness; no production update was published.
- Full local Vitest: 141 files / 1,123 tests passed; 18 Node tests passed.
- Full Biome lint, ESLint and TypeScript passed. Changed UI files pass Biome
  check. No search/backend changes were introduced in this follow-up.
- Full repository formatting reports two existing, unchanged files:
  `scripts/publish-production-ota.mjs` and
  `src/features/learning-plans/use-prepare-session-content.ui.test.tsx`. Both are
  identical to a58b0d79. They are outside this follow-up and were not edited.
- Local commands used the installed tools directly because the shared dependency
  symlink causes pnpm exec to attempt dependency installation. Local Node is
  v25.9.0, outside the repository's supported 24.x range; current CI passed in
  its configured environment.
- Full local Jest did not complete: interrupted after approximately six minutes
  with 14 suites reporting success and no final summary. The last reported suite
  was pause-navigation; no cause is established. This run is not counted as a
  pass. The earlier focused run passed 78 tests; the independent current-product
  CI quality job passed.
- Full Tailwind class-order check passed. Product diff and evidence metadata
  reviewed; no additional in-scope findings.
