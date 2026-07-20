# Context Map

This repo uses a multi-context documentation layout for agent-facing, code-adjacent technical and domain guidance.

Notion is Dayova's main internal documentation and knowledge workspace. The local context docs listed here should contain only the implementation-facing terminology, architecture, constraints, and decision pointers that agents need to change this repository safely. Link to relevant Notion records instead of duplicating shared internal documentation.

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
