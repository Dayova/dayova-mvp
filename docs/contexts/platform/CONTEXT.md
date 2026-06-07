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

## Release Environment

Native release builds and OTA update bundles must have these public app envs
available while Expo bundles JavaScript:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`

`app.config.ts` fails release config evaluation when either value is missing, so
a broken artifact cannot ship and crash on startup. Set these in EAS/CI for the
target environment before running production builds or publishing updates.

The mobile app reads these values through `src/lib/runtime-config.ts`, which uses
`@t3-oss/env-core` with the `EXPO_PUBLIC_` client prefix and an explicit
`runtimeEnvStrict` map so Expo bundles every required public variable.

When adding a new required public app env, add it to `publicEnvSchema` in
`src/lib/runtime-config.ts`. The app runtime fallback, tests, and
`app.config.ts` release validation all derive their required-key list from that
schema.
