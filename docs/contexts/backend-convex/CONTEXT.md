# Convex Backend Context

This context covers Convex schema, functions, indexes, migrations, backend data access patterns, and server-side domain behavior.

When working on Convex code, always read `convex/_generated/ai/guidelines.md` first.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Language

**User-facing backend error**:
An intentional backend failure whose message is safe for the learner to see and explains what they can do next in German.
_Avoid_: Client error, server error, raw exception

**Diagnostic error detail**:
Internal failure context used by the Dayova team to debug production problems; it can include raw errors, stack traces, request metadata, and provider responses, but must not be shown to learners.
_Avoid_: User-facing message, learner error text

## Notes

- Convex keeps `users.schoolType` schema-compatible with legacy strings while
  every current write boundary accepts only the seven stable `Schulart` keys.
  Authenticated profile sync lazily maps exact generic legacy values and
  removes ambiguous user/profile-answer values without logging them.
- Capture backend data model, function boundaries, and migration decisions here.
- Put backend ADRs in `docs/contexts/backend-convex/adr/`.
