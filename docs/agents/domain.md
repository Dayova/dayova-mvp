# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Documentation sources

Notion is Dayova's main internal documentation and knowledge workspace. Technical and non-technical team members use it for product and business context, research, meeting notes, decisions, operating knowledge, and other information the team needs to know, understand, or remember.

Repo-local context docs and ADRs are code-adjacent technical guides. They capture the stable terminology, architectural constraints, implementation contracts, and decision pointers that must evolve with this repository. They should link to the relevant Notion page and summarize only the implementation-critical detail needed to work safely; they are not a second internal knowledge base.

## Agent access

Use the semantic Notion connector when a task depends on internal product, business, research, meeting, or decision context. Search Notion before claiming that internal guidance does not exist, and preserve the canonical Notion page URL when referencing it from Linear, GitHub, or repo-local docs. If Notion access is unavailable, state that limitation and continue from available repo context without inventing or silently reconstructing internal documentation.

Do not use browser automation as the default Notion API. Do not copy private internal material into the repository when a link and concise implementation-facing summary are sufficient.

Use this ownership rule consistently:

- If it needs to be done, tracked, assigned, or moved through a workflow, it belongs in Linear.
- If it needs to be known, understood, discussed, or remembered internally, it belongs in Notion.
- If it changes code or defines a code-facing technical contract, it belongs in GitHub and the relevant repo-local context doc or ADR.

Do not create mirrored task databases or parallel execution workflows in Notion. Notion pages may link to or embed Linear issues, projects, and views; actionable follow-ups discovered in Notion must be created in Linear.

When documentation disagrees, treat Notion as canonical for current internal product and business context. Treat the code, tests, and repo-local ADRs as canonical for implemented technical behavior. Surface the drift and reconcile both sources rather than silently choosing or copying stale content.

## Layout

This repo uses a multi-context documentation layout.

Read `CONTEXT-MAP.md` at the repo root first. It points to the relevant context files for the area being changed.

Recommended context areas for Dayova:

- Product and learning domain
- Expo mobile app
- Convex backend
- Auth and identity
- Design system
- Integrations
- Platform and release infrastructure

System-wide architectural decisions should live under `docs/adr/`.

Context-specific decisions may live beside their context docs, for example:

- `docs/contexts/product/adr/`
- `docs/contexts/mobile-app/adr/`
- `docs/contexts/backend-convex/adr/`
- `docs/contexts/auth/adr/`
- `docs/contexts/design-system/adr/`
- `docs/contexts/integrations/adr/`
- `docs/contexts/platform/adr/`

## Before exploring, read these

- `CONTEXT-MAP.md` at the repo root, if it exists
- The context docs listed there that are relevant to the task
- `docs/adr/` for system-wide decisions
- Context-specific ADRs for the area being changed
- Relevant Notion pages when product, business, research, meeting, or decision context materially affects the task

If these files do not exist yet, proceed silently. The `/domain-modeling` skill can create them lazily when terminology or code-facing decisions are resolved.

## Use project vocabulary

When output names a domain concept, use the term from the relevant context docs. If the concept is not documented yet, avoid inventing new terminology without noting the assumption.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly instead of silently overriding it.

## Writing and linking

- Create shared internal documentation in Notion.
- Add a canonical Notion link to a context doc or ADR when that shared decision materially affects implementation.
- Keep repo-local summaries concise and durable; do not paste whole Notion pages into the repository.
- Put actionable follow-up work in Linear and link it from Notion or the repo where useful.
