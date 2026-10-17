# Topic search, then hint search — 18 October 2026

[Current gallery](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6242468537) · [QA, decision brief and limits](../../qa/sequential-topic-hint-search-2026-10-18.md) · [Asset hashes and URLs](sequential-search-assets.json).

Product revision: `3d411e830e494fd1e2acc755f431ace04a03ac80`. This supersedes the inline layout at `30c80460` (product-identical to docs-only `9836c7ff`). The gallery reuses that revision’s original images and 52.88-second recording as the **incremental before**, not the integration base. Historical differences in selected-topic counts and fixture controls are explicit.

Four new PNGs and the unchanged 69.15-second MP4 were uploaded with official GitHub CLI 2.102.0 using repeated native `--attach` flags and the existing Gamius00 account. The published body contains eight native attachment URLs including three reused baseline assets. Browser verification found all six gallery images loaded at 1206×2622 and both videos readyState 4, durations 52.88 / 69.15 seconds, with no media errors. No media binary is committed to the app branch.

## New captures

- [topics-dark.png](https://github.com/user-attachments/assets/bf9146eb-9602-49f2-936f-d3c714d8fd4c)
- [hints-dark.png](https://github.com/user-attachments/assets/7efdd3dd-b227-41e7-a38d-85950db9e4ec)
- [hints-selected-dark.png](https://github.com/user-attachments/assets/30704b79-17ef-4540-a354-3637391d9262)
- [hints-light.png](https://github.com/user-attachments/assets/c52901ec-fb59-4592-a077-850c5b83a697)
- [two-page-flow.mp4](https://github.com/user-attachments/assets/7b08a72c-73bd-4de2-94ba-1cbffe9787aa)

## Complete-timeline inspection

All five full-timeline contact sheets and individual frames at 23, 43, 59 and 65 seconds were inspected.

- 0–15s: topic-only page with Rhetor, existing Gedichtanalyse chip and two subject-labelled suggestions.
- 16–22s: Rhetorische Mittel selected as a second chip.
- 23–33s: separate optional hint page with two suggestions.
- 34–38s: Text filters the hints.
- 39–42s: first hint selected; query clears.
- 43–47s: both suggestions selected.
- 48–52s: custom Nur Kapitel 3 entry and addition.
- 53–58s: material page.
- 59–64s: back to hints, all three selections retained.
- 65–68s: back to topics, both topic selections retained.

Coverage: 69.15-second video; 69 full-timeline frames sampled at 1 fps (1-second interval); 5 contact sheet(s); no audio stream.

No transcription needed. One-second sampling cannot exclude brief intervening events. Separate post-recording screenshots and native state checks confirm custom-hint removal, returning to the two selected hints, and light appearance. The first 15 seconds include a capture-control retry; they are not a search-latency measurement.

## Capture scope

Real RequiredTopicsStep, ExamHintsStep, MaterialUploadStep, progress header and keyboard-aware scroll inside a temporary local preview. iPhone 17 Pro / iOS 26.5, shared Dayova fonts and themes, synthetic Deutsch/Gedichtanalyse state, controlled Rhetor results. Local-state navigation, no live WLO or authenticated backend persistence. The fixture footer, theme-toggle Close action and floating developer gear are capture controls. No product preview entry or component substitutions remain.

The final capture used a `--no-dev` bundle in the existing development client after development-mode rendering stalled. No cause was established; the successful capture does not establish a development-runtime fix. See QA for platform and accessibility limits. The old TestFlight package is unchanged, and this PR remains draft.
