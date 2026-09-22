# Dayova app consolidation — 2026-09-22

## Canonical app workspace

The mobile app's canonical repository is `/Users/philipp/Documents/ChatGPT/dayova-mvp`.
The consolidation branch is `codex/consolidate-app-work-20260922`.

The website remains a separate product repository. No website implementation was
copied into the mobile app.

## Sources audited

- `/Users/philipp/Documents/dayova-website/.codex-dayova-prs`
- all immediate worktrees below `/Users/philipp/Documents/dayova-website/.codex-worktrees`
- `/Users/philipp/Documents/dayova-mvp`
- `/Users/philipp/Documents/GitHub/dayova-mvp`
- `/Users/philipp/Documents/ChatGPT/Dayova APp`
- `/Users/philipp/Documents/dayova-screenshot-temp-20260817/dayova-screens-build`

Generated dependency, build, CocoaPods, DerivedData, `.next`, and cache content was
excluded from source consolidation.

## Consolidated changes

- merged the current `origin/main`, including the final DAY-392 and DAY-393 work;
- retained the newer simulator integration's dialog lifecycle, accessibility,
  keyboard, safe-area, and navigation behavior while resolving the merge;
- included the PR #662 follow-up commit `3ef62a2`;
- included the PR #651 test follow-up commit `74acba2`;
- included the DAY-187 evidence follow-up commit `ff939ce`;
- verified that PR #693's add-action design is already present as an evolved
  implementation in the consolidated tree;
- migrated the only uncommitted app source change found in the website worktrees:
  the long-word dashboard card title fix and its UI test from
  `dayova-dashboard-title`.

The active `.env.local` is the canonical app environment file and contains all
variable names present in the older app environment plus the current Convex
deployment/site configuration. Secret values are intentionally not recorded here.

## Audited but not imported

- `Documents/GitHub/dayova-mvp/apps/web` is a standalone, uncommitted Next.js
  starter and generated `.next` output, not mobile-app functionality.
- `Documents/ChatGPT/Dayova APp` is an empty Git repository without commits or
  app source.
- `dayova-screenshot-temp-20260817` is a July 2026 screenshot/build copy plus
  generated iOS build data; its source predates the canonical app history.
- dependency backups, old package patches, `node_modules`, Pods, build products,
  and caches are reproducible artifacts and are not source-of-truth inputs.
- the dirty `Documents/dayova-mvp` checkout contains an older personal-subjects
  implementation, older package versions, and intermediate navigation/UI edits.
  Its app behavior is represented by newer commits and implementations in the
  consolidated branch. Its local environment backup remains outside Git.

## Deletion gate

Do not delete the legacy locations until this branch has passed the iOS simulator
build and has been pushed to its pull request. After that, the following app-only
copies are cleanup candidates:

- `/Users/philipp/Documents/dayova-website/.codex-dayova-prs`
- the app worktrees below `/Users/philipp/Documents/dayova-website/.codex-worktrees`
  (`all-open-prs-simulator`, `day-187`, `day-187-base`, `day-376`,
  `day-377-batch`, `day-392-review`, `day-393`, `day-402`, `day-415-review`,
  `day-417`, `day-436`, `day-437-native-qa`, `day-445`,
  `dayova-dashboard-title`, `dayova-mvp-issue-623`, and
  `simulator-add-actions`);
- `/Users/philipp/Documents/dayova-screenshot-temp-20260817`;
- `/Users/philipp/Documents/ChatGPT/Dayova APp`.

The old `/Users/philipp/Documents/dayova-mvp` and
`/Users/philipp/Documents/GitHub/dayova-mvp` roots require a separate explicit
cleanup confirmation because they contain local environment/back-up files or an
uncommitted web starter in addition to obsolete app copies.
