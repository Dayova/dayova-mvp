# Sequential topic and hint search — 18 October 2026

The latest explicit request supersedes the prior inline layout: first only topic search, then the same interface for optional hints. Implementation remains in PR #884 / DAY-530. [Notion decision](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a). Student validation in DAY-517 remains open.

## Decision brief

- Job: choose exam topics, then record only applicable exam instructions.
- Hierarchy: question first, search and current selections second, suggestions third.
- Primary action: Weiter at the bottom advances topics → optional hints → material.
- Friction: remove the competing second search and large textarea from the topic page; reveal full-text editing only for existing hints.
- Decision: two sequential pages sharing search, removable chips and plus/check suggestion rows. Keep Jakob’s subject-aware topic lookup and deterministic hint suggestions. Hints stay optional; all additions/removals are explicit.

## Behavior and review

Back traverses material → hints → topics. The existing save/pause paths retain both fields and the compatibility projection; failed saves leave edits visible. Old placement preferences no longer control the flow. Existing hint text retains whitespace until explicitly edited, and newline boundaries are the only chip boundaries. Full-text editing supports long legacy prose. No backend, provider ranking, cache or schema changes.

Review covered route entry/back/continue, busy and error states, saved drafts, hint filtering, exact selection matching, chip removal, own entries and unchanged legacy text. Shared controls expose checked/disabled states and removal labels; minimum row/chip heights are 56/48 points. The initial large textarea was the weakest visual element and is now a secondary edit action.

## Validation

- Node 24.22.0: full Vitest 141 files / 1,124 tests passed.
- Full Jest: 103 suites / 556 tests passed, including 84 focused flow/search/hints tests.
- Node repository tests: 18 passed.
- TypeScript, full Biome lint, changed-file Biome check and full ESLint passed.
- Diff reviewed, including compatibility and scope separation; no outstanding in-scope finding.

## Native evidence and limits

The linked evidence report records the exact product revision, native attachments and complete-timeline video inspection. iPhone 17 Pro / iOS 26.5 component preview uses the real topic/hints/material components, progress header and keyboard-aware scroll, synthetic Deutsch/Gedichtanalyse state, and controlled WLO results. The preview uses local state; it does not establish authenticated backend save/reopen.

Development-mode rendering became unresponsive after first paint, including with temporary header and scroll substitutions. The final captures restore the original shared components and use Expo `--no-dev`; interactive capture then succeeds. The specific diagnostic cause was not established. This is not a shipped native build. Placeholder legal URLs were used only to satisfy preview configuration; no links were opened and no deployment occurred.

Dark topics and empty/selected hints, light selected hints, topic selection, filtering, multiple/custom hints, removal and back navigation were inspected. No current Android device was attached. Android, physical iPhone, software-keyboard layout, screen-reader focus, large text and full signed-in persistence remain open. TestFlight 1.0.7 (78) does not contain this update. Historical placement-study results are not acceptance of this revision.
