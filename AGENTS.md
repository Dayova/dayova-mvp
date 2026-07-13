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

### Issue tracker

Linear is the source of truth for issues and PRDs: use workspace `dayova`, team `Dayova` (`DAY`). `Dayova/dayova-mvp` GitHub Issues remains a bidirectionally synced compatibility surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Map the `bug` and `enhancement` category roles plus the five triage disposition roles through `docs/agents/triage-labels.md`; do not substitute similarly named Linear labels.

### Domain docs

Use a multi-context documentation layout with `CONTEXT-MAP.md` at the repo root; Confluence is the current cross-functional documentation hub for the wider team, while repo-local context docs guide agents and technical work. See `docs/agents/domain.md`.

### Skill maintenance

Matt Pocock skill updates require the repo's Codex and Linear compatibility overlay to be revalidated. See `docs/agents/matt-pocock-skills.md`.
