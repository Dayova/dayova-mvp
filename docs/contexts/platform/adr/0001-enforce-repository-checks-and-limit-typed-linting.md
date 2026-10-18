---
status: accepted
accepted_by: Jakob Rössner
accepted_on: 2026-10-18
---

# Enforce repository checks and limit typed linting

The canonical [decision record in Notion](https://app.notion.com/p/3fd2e87228bf81f98b45f94017f0079d)
contains the rationale, tradeoffs, changed-file inventory, and historical
evidence for [PR #846](https://github.com/Dayova/dayova-mvp/pull/846).
Jakob Rössner explicitly accepted the decision in the Codex/T3 conversation on
2026-10-18. Decision acceptance does not itself merge or release the PR.

This file is a code-facing reference; maintain the full decision record in
Notion. The implementation contracts remain in the
[platform context](../CONTEXT.md#ci-quality-gate):

- The shared CI job enforces formatting, lint, unused code/dependencies,
  repository skill validation, TypeScript, and tests.
- PR triggers cover every target branch, including stack parents, while the
  same-repository and contributor trust gates remain. Deployment and OTA
  publication require a push to `main` and their existing safety gates.
- UI ESLint uses syntax-only parsing; Convex retains TypeScript project
  services. Biome and Knip keep their existing responsibilities.

## Concrete evidence for the stacked-PR coverage gap

The observed case was **PR #846 itself on 16 October 2026**, after its base
changed from `main` to `codex/android-screens-startup-race`. Commit
[`33789310`](https://github.com/Dayova/dayova-mvp/commit/337893105195cf8a822b0eea906f355d93da8a5b)
still restricted PR CI to `main`; its status history contains no EAS
`Continuous Integration / …` entries and reports OTA freshness as pending:
“Latest commit has no current OTA report; compatibility unconfirmed.”

After [`a8a48615`](https://github.com/Dayova/dayova-mvp/commit/a8a4861511ae899756570873d662fb4f9d52128f)
removed the filter, EAS quality CI ran and passed. The first OTA job was canceled
when superseded; it is not counted as a completed assessment. See the
[timestamped evidence and source APIs](https://github.com/Dayova/dayova-mvp/pull/846#issuecomment-6252206160)
for the exact before/after statuses, later complete result, and evidence limits.
