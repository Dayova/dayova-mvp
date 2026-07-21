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
- Analytics events must go through `src/lib/analytics.ts`. PostHog autocapture, lifecycle events, anonymous pre-auth tracking, and session replay are intentionally disabled for the validation phase.
- PostHog identity properties are limited to validation-relevant IDs and coarse student context. Do not send names, email addresses, birth dates, avatar URLs, raw notes, uploaded content, or learner answers as analytics properties.
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

## Package Manager Toolchain

Dayova uses pnpm 11.15.1 on Node 24.18.0. Keep the pnpm version pinned exactly
and identical in `package.json`, the shared `eas.json` build profile, and
`.eas/workflows/ci.yml`. These are separate install surfaces, so the repeated
pin is intentional; `tests/pnpm-toolchain.test.ts` guards them against drift.

The 2026 rollback from pnpm 11 to pnpm 10 was an EAS runtime compatibility
measure, not an application compatibility requirement: the then-current EAS
image ran Node 20.19.4, while pnpm 11 required a newer Node runtime. The project
now pins Node 24 for local and EAS builds, so that constraint no longer applies.

Keep non-auth pnpm settings in `pnpm-workspace.yaml`, where pnpm 11 reads them.
An `.npmrc` may contain registry and authentication entries, but must not
contain pnpm behavior settings such as `auto-install-peers` or
`only-built-dependencies`.
In particular, keep `autoInstallPeers: false`, preserve `patchedDependencies`,
and use `allowBuilds` as the only dependency build-script policy. When changing
the pnpm version, update all three pins together and verify a frozen install,
the full checks, production exports, and native EAS builds.

## iOS Privacy Purpose Strings

Dayova uses camera/photo upload for learning material and microphone/speech
recognition for spoken answers. Keep these App Store privacy purpose strings in
`app.config.ts`. If a local native `ios/Dayova/Info.plist` exists after
prebuild, keep it in sync too:

- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`

`src/lib/ios-privacy-config.test.ts` always guards `app.config.ts` and also
checks the generated native plist when it exists. Run it before an iOS release
build so App Store Connect does not reject the uploaded bundle for missing
purpose strings.

## iOS Deployment Target

Dayova currently requires iOS 17.0 because the native Clerk Expo SDK requires
it. The `@clerk/expo` config plugin writes that target to the generated Xcode
project and `Podfile.properties.json` during prebuild. This requirement predates
the Expo SDK 57 upgrade even though Expo SDK 57 itself supports iOS 16.4 and
newer.

Keep Dayova-owned native modules compatible with Expo's 16.4 baseline unless a
higher target is intentional and documented. Re-evaluate the app-wide iOS 17.0
minimum when Clerk lowers its native SDK requirement or Clerk is replaced.

See `modules/dayova-system-appearance/README.md` for the appearance module's
runtime design, React Native coupling, compatibility policy, test matrix, and
removal criteria.
