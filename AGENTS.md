Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Agent skills

### Delivery workflow

For requests to implement, fix, build, update, refactor, or address review feedback, completion includes validation, an intentional commit containing only the in-scope changes, and a push to the non-default feature or pull-request branch. The user does not need to repeat “commit and push.” Update an existing pull request when one exists; otherwise create a scoped `codex/` branch from the current default branch and open a draft pull request when the work is ready for review.

Never push directly to the default branch, stage unrelated user changes, or mix a distinct follow-up into the current branch. Put unrelated follow-up work on a separate branch, commit, and pull request. Read-only review, diagnosis, explanation, research, and status requests remain non-mutating. Stop and surface the blocker when scope is ambiguous, unrelated changes cannot be separated safely, validation has a material failure, authentication is unavailable, or the remote changed unexpectedly.

### Issue tracker

Linear is the source of truth for issues and PRDs: use workspace `dayova`, team `Dayova` (`DAY`). `Dayova/dayova-mvp` GitHub Issues remains a bidirectionally synced compatibility surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Map the `bug` and `enhancement` category roles plus the five triage disposition roles through `docs/agents/triage-labels.md`; do not substitute similarly named Linear labels.

### Domain docs

Use a multi-context documentation layout with `CONTEXT-MAP.md` at the repo root. Notion is Dayova's main internal documentation and knowledge workspace; consult it when product, business, research, or decision context materially affects the task. Repo-local context docs and ADRs contain only the code-facing guidance that must evolve with this repository. Link to relevant Notion pages instead of duplicating shared internal documentation. See `docs/agents/domain.md`.

### Skill maintenance

Matt Pocock skill updates require the repo's Codex and Linear compatibility overlay to be revalidated. See `docs/agents/matt-pocock-skills.md`.

Expo skill updates must use the repository's composition command so Dayova's
patch queue is checked and reapplied without loading a second runtime skill. See
`docs/agents/expo-skills.md`.

### Video evidence

When a Linear issue, bug report, or task contains a video or screen recording,
use `$inspect-video-evidence` before making claims about temporal behavior.
Require complete-timeline coverage, timestamped observations, and a coverage
statement. Treat thumbnails, poster frames, Quick Look previews, and isolated
screenshots as still-image evidence only.
