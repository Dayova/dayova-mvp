# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Documentation sources

Confluence is the current cross-functional documentation hub for Dayova. It is used by technical and non-technical team members and may later move to Notion.

Repo-local context docs are agent-facing technical/domain guides. They should capture the terminology, architectural context, and implementation-facing decisions that agents need while working in this repo. They may summarize or link to Confluence where useful, but they are not a replacement for shared team documentation.

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

If these files do not exist yet, proceed silently. The producer skill `/grill-with-docs` can create them lazily when terminology or decisions are resolved.

## Use project vocabulary

When output names a domain concept, use the term from the relevant context docs. If the concept is not documented yet, avoid inventing new terminology without noting the assumption.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly instead of silently overriding it.
