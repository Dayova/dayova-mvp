# Platform and Release Infrastructure Context

This context covers environments, builds, releases, EAS, CI/CD, deployment, secrets, local development, and operational workflows.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Language

**Diagnostic error detail**:
Internal failure context used by the Dayova team to debug production problems; it can include raw errors, stack traces, request metadata, and provider responses, but must not be shown to learners.
_Avoid_: User-facing message, learner error text

## Notes

- Expo public env vars prefixed with `EXPO_PUBLIC_` are bundled into the mobile app and must only contain public client-side values.
- `EXPO_PUBLIC_POSTHOG_API_KEY` enables PostHog analytics in the Expo app. Leave it empty to disable analytics locally.
- `EXPO_PUBLIC_POSTHOG_HOST` defaults to `https://eu.i.posthog.com`; use a Dayova-owned reverse proxy only if event delivery or privacy requirements justify the extra infrastructure.
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

PostHog validation analytics envs are optional public app envs:

- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`

Do not add optional public envs to the required release-key list unless the app
cannot function without them. The analytics client must stay disabled gracefully
when the PostHog key is absent.
