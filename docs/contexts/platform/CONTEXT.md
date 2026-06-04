# Platform and Release Infrastructure Context

This context covers environments, builds, releases, EAS, CI/CD, deployment, secrets, local development, and operational workflows.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Language

**Diagnostic error detail**:
Internal failure context used by the Dayova team to debug production problems; it can include raw errors, stack traces, request metadata, and provider responses, but must not be shown to learners.
_Avoid_: User-facing message, learner error text

## Notes

- Capture platform conventions, release processes, and environment decisions here.
- Put platform ADRs in `docs/contexts/platform/adr/`.
