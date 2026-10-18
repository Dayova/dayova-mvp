# PR #846: evidence for CI coverage on stacked PRs

This evidence supports the branch-routing rationale in the
[accepted Notion decision record](https://app.notion.com/p/3fd2e87228bf81f98b45f94017f0079d).
It was collected from GitHub's historical APIs on 2026-10-18. Times below are
UTC. The [normalized snapshot](github-status-history.json) preserves the
relevant returned fields and their source URLs.

## Before the filter change

1. At **2026-10-16 18:26:52**, PR #846's base changed from `main` to
   `codex/android-screens-startup-race`. The
   [timeline event](https://github.com/Dayova/dayova-mvp/pull/846#event-33472428563)
   and [event API](https://api.github.com/repos/Dayova/dayova-mvp/issues/events/33472428563)
   identify the event/time. GitHub's GraphQL `BaseRefChangedEvent` supplies the
   `previousRefName` and `currentRefName` captured in the snapshot.
2. At **19:58:30**, commit
   [`337893105195cf8a822b0eea906f355d93da8a5b`](https://github.com/Dayova/dayova-mvp/commit/337893105195cf8a822b0eea906f355d93da8a5b)
   changed the Biome coverage reporter. Its
   [workflow still filters PR targets to `main`](https://github.com/Dayova/dayova-mvp/blob/337893105195cf8a822b0eea906f355d93da8a5b/.eas/workflows/ci.yml#L3-L11).
3. The [commit's full status history](https://api.github.com/repos/Dayova/dayova-mvp/commits/337893105195cf8a822b0eea906f355d93da8a5b/statuses?per_page=100)
   contains four entries: three CodeRabbit statuses and **OTA report freshness,
   pending**, at **19:58:51**, with the description **“Latest commit has no
   current OTA report; compatibility unconfirmed.”** It has no EAS
   `Continuous Integration / …` statuses. Its
   [check-runs history](https://api.github.com/repos/Dayova/dayova-mvp/commits/337893105195cf8a822b0eea906f355d93da8a5b/check-runs?per_page=100&filter=all)
   contains only the successful GitHub Actions `reconcile` job; that job is not
   the EAS quality suite.

## After the filter change

At **20:07:03**, commit
[`a8a4861511ae899756570873d662fb4f9d52128f`](https://github.com/Dayova/dayova-mvp/commit/a8a4861511ae899756570873d662fb4f9d52128f)
removed the PR base-branch filter and added the routing regression assertion.
The [EAS quality job](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14653-56bc-77a9-8685-0af37252b08a#job-01a14653-5cd3-73f2-8440-d8e3fbb61c1c)
was queued at **20:07:12** and succeeded at **20:12:27**. Its
[status history](https://api.github.com/repos/Dayova/dayova-mvp/commits/a8a4861511ae899756570873d662fb4f9d52128f/statuses?per_page=100)
records both timestamps. That run's production OTA job was canceled at
**20:18:00** when superseded, so this run does not establish a completed OTA
assessment.

The later [final-source validation comment](https://github.com/Dayova/dayova-mvp/pull/846#issuecomment-6224665727)
and [EAS run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14683-cd84-79fe-8527-891b84a0d1f6)
record completed checks/report for source
`5cd07636ae6b0c3ac1b0a5ff73f79bbae5941c3d`. These are historical results for
those commits, not fresh tests performed while writing this evidence.

## Interpretation and limits

EAS [matches the PR's target branch](https://docs.expo.dev/eas/workflows/syntax/#onpull_request).
The recorded base and `main` filter therefore explain why this automatic PR
workflow did not qualify. The status histories independently show the missing
EAS statuses and pending freshness verdict for the affected commit. They do not
establish that nobody ran local or manual checks, and this record does not claim
that a verified list of other PRs experienced the same incident.

The snapshot includes every pre-fix status and check run, but only the relevant
quality-job statuses and canceled OTA result after the fix. Original commit
hashes are used because the branch was later rebased; rewritten local hashes do
not carry the original remote statuses.
