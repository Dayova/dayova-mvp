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

For explicitly mutating repository work (for example implementation, fixes, refactors, or review-feedback changes), completion normally includes:

1. validate the result;
2. review the change;
3. commit only the coherent in-scope changes;
4. publish them to a branch owned by the current work; and
5. update the existing pull request, or open a draft pull request when appropriate.

The user does not need to repeat “commit and push.” Preserve the existing branch, pull request, and stack when the task belongs to one. Push only a branch that already represents the current work item or pull request, or a new branch intentionally created for this work.

For new work, determine the correct integration base from the task, current branch, stack, and repository workflow; create a scoped `codex/` branch from that base. Do not assume the default branch is always the correct base.

Never push directly to the default branch, treat another developer's, release, shared integration, or stack-parent branch as safe merely because it is non-default, stage unrelated user changes, or mix a distinct follow-up into the current branch. Put unrelated follow-up work on a separate branch, commit, and pull request. Read-only review, diagnosis, explanation, research, and status requests remain non-mutating. Stop and surface the blocker when scope or branch ownership is ambiguous, unrelated changes cannot be separated safely, validation has a material failure, authentication is unavailable, or the remote changed unexpectedly.

When a concrete unrelated problem is discovered, either fix it completely on a separately owned branch when the outcome is unambiguous, low-risk, independently verifiable, and cheaper than reopening context; reconcile it into existing Linear work when it needs ownership, judgment, or material effort; or discard it when it is speculative or not worth retaining. Search Linear before creating work and never expand the current branch merely because a problem was discovered. See `docs/agents/agent-system.md`.

### Pull-request evidence

Every pull request requires a before screenshot, after screenshot, before screen recording, and after screen recording attached directly to the PR. Capture the baseline before editing; for stacked work, the baseline is the PR's actual parent. Use the most meaningful observable surface for non-UI changes. Keep the PR draft and surface the blocker when the four artifacts cannot be produced. The linked evidence program in `docs/agents/agent-system.md` owns capture and enforcement.

User-facing plans and pull requests also require the distinct Dayova product-quality review linked from `docs/agents/agent-system.md`; generic code review does not replace it.

### Agent-system architecture

Notion owns durable company knowledge and decisions, Linear owns executable work, and GitHub owns code and implementation evidence. Keep `AGENTS.md` to always-on rules and routing; put conditional repeatable workflows in repository skills and detailed code-adjacent contracts in `docs/agents` or `docs/contexts`. Linear Agent and Luma operations are event-scoped reconciliation workflows, not parallel task or skill catalogs. Use `$maintain-dayova-agent-system` for changes to skills, agent instructions, composition, routing, authorization, or evaluations; see `docs/agents/agent-system.md`.

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
