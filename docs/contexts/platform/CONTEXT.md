# Platform and Release Infrastructure Context

This context covers environments, builds, releases, EAS, CI/CD, deployment, secrets, local development, and operational workflows.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Notes

- Expo public env vars prefixed with `EXPO_PUBLIC_` are bundled into the mobile app and must only contain public client-side values.
- `EXPO_PUBLIC_POSTHOG_API_KEY` enables PostHog analytics in the Expo app. Leave it empty to disable analytics locally.
- `EXPO_PUBLIC_POSTHOG_HOST` defaults to `https://eu.i.posthog.com`; use a Dayova-owned reverse proxy only if event delivery or privacy requirements justify the extra infrastructure.
- Capture platform conventions, release processes, and environment decisions here.
- Put platform ADRs in `docs/contexts/platform/adr/`.
