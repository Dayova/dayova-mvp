# Context Map

This repo uses a multi-context documentation layout for agent-facing, code-adjacent technical and domain guidance.

Notion is Dayova's main internal documentation and knowledge workspace. The local context docs listed here should contain only the implementation-facing terminology, architecture, constraints, and decision pointers that agents need to change this repository safely. Link to relevant Notion records instead of duplicating shared internal documentation.

## Canonical knowledge entry points

- [Agent system and knowledge routing](https://app.notion.com/p/3b42e87228bf816e9343c3fc33fa73ca)
- [Developer handbook](https://app.notion.com/p/3dc2e87228bf815e890fc5f1397c4940)
- [Decision Records and reading contract](https://app.notion.com/p/3b62e87228bf818f9164e64de4dca2bd)
- [Knowledge and evidence storage decision](https://app.notion.com/p/3fd2e87228bf8140ba9be6c68d51fcaf)

Read the relevant linked page and search Notion before creating internal
documentation or a decision record. Use the task's Linear issue and GitHub PR
for dated validation reports, screenshots, recordings, and historical evidence.
Do not recreate task-archive folders in the repository. See
[the reading and writing workflow](docs/agents/domain.md).

## Contexts

- Product and learning domain: `docs/contexts/product/CONTEXT.md`
- Expo mobile app: `docs/contexts/mobile-app/CONTEXT.md`
- Convex backend: `docs/contexts/backend-convex/CONTEXT.md`
- Auth and identity: `docs/contexts/auth/CONTEXT.md`
- Design system: `docs/contexts/design-system/CONTEXT.md`
- Integrations: `docs/contexts/integrations/CONTEXT.md`
- Platform and release infrastructure: `docs/contexts/platform/CONTEXT.md`

## Existing Repo Docs

- Bottom sheets: `docs/bottom-sheets.md`
- Styling: `docs/styling.md`
- Package patches: `patches/README.md`
- iOS system appearance module: `modules/dayova-system-appearance/README.md`

## ADRs

- System-wide decisions: `docs/adr/`
- Context-specific decisions may live in `docs/contexts/<context>/adr/`.
- iOS system appearance bridge:
  `docs/contexts/mobile-app/adr/0001-use-local-ios-system-appearance-bridge.md`

If a listed context file does not exist yet, proceed with code exploration and mention any domain assumptions that materially affect the work.
