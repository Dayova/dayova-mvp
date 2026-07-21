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
- Clerk user ID is the PostHog `distinctId`, never a `clerk_id` property. Custom identity is exactly optional `convex_user_id`, optional `validation_student_code`, bounded `grade` (`6` through `13`), and bounded German federal `state`; `school_type` is excluded pending DAY-253.
- Names, email addresses, birth dates, avatar URLs, school names, raw notes, filenames, uploaded content, learner answers, transcripts, and diagnostic error detail are never analytics properties.
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

## Validation Analytics Runtime Contract

Every allowed custom event receives `analytics_schema_version` and may receive
only centrally generated `validation_student_code`, `eas_update_id`,
`eas_channel`, `eas_runtime_version`, and `eas_is_embedded_launch` shared
context. The exact event-property pairs are:

- `onboarding_completed`: `local_day_key`, `onboarding_version`
- `homework_created`: `day_entry_id`, `planned_day_key`, `due_day_key`, `duration_minutes`
- `exam_created`: `day_entry_id`, `planned_day_key`, `duration_minutes`, bounded `exam_type`
- `material_uploaded`: `learning_plan_id`, bounded `file_type`, bounded `file_size_bucket`
- `study_plan_generated`: `learning_plan_id`, `session_count`
- `study_slot_started`: slot context plus `started_at`
- `study_slot_completed`: slot context plus `outcome_at`
- `study_slot_partially_completed`: slot context plus `outcome_at`
- `study_slot_missed`: slot context plus `outcome_at` and bounded `missed_reason`
- `plan_adjusted`: original/new session IDs, bounded `adjustment_type`, old/new planned day keys and durations, and optional bounded `missed_reason`
- `user_returned_next_day`: `local_day_key`, `previous_activity_day_key`

Slot context is exactly `learning_plan_id`, `learning_plan_session_id`, bounded
`phase`, `planned_day_key`, `planned_start_time`, `duration_minutes`, and
optional `deadline_day_key`. Exact bounded vocabularies are documented in
`docs/contexts/integrations/CONTEXT.md` and implemented in
`src/lib/analytics.ts`.

Runtime projection is value-aware even when TypeScript is bypassed. Development
and tests throw on unknown keys or invalid values. Production omits invalid
optional values, drops events with invalid required values, and records only the
event/property name in diagnostics. `before_send` repeats the custom-key guard
as defense in depth without filtering PostHog SDK/system properties.

## Package Manager Toolchain

Dayova uses pnpm 11.15.1 on Node 24.18.0. The pnpm version is repeated because
each install surface selects its toolchain independently: `package.json`
controls local Corepack, the shared `eas.json` profile controls native EAS
Build workers, and `.eas/workflows/ci.yml` controls EAS Workflow jobs. Keep
those pins exact and identical so no surface falls back to a different image
default. Keep `pmOnFail: error` in `pnpm-workspace.yaml` so a mismatched pnpm
binary fails immediately instead of downloading and running another version.
The removed pnpm 10 setting `packageManagerStrictVersion` must not be restored;
pnpm 11 replaced it with `pmOnFail`. `tests/pnpm-toolchain.test.ts` guards this
policy against drift.

The 2026 rollback from pnpm 11 to pnpm 10 was an EAS runtime compatibility
measure, not an application compatibility requirement: the then-current EAS
image ran Node 20.19.4, while pnpm 11 required a newer Node runtime. The project
now pins Node 24 for local and EAS builds, so that constraint no longer applies.

### Why this policy exists

pnpm 11 changed where it reads configuration: `.npmrc` is now limited to
registry and authentication entries, while behavioral settings belong in
`pnpm-workspace.yaml`. Leaving `auto-install-peers=false` in `.npmrc` would
silently restore pnpm's default of installing missing peer dependencies.
Keeping `autoInstallPeers: false` in the workspace file instead preserves
Dayova's policy that peer dependencies must be declared deliberately.

pnpm 11 also replaced the legacy dependency-build settings, including
`onlyBuiltDependencies`, with one `allowBuilds` map. Dayova keeps that map as
the sole lifecycle-script policy so an unreviewed dependency cannot execute
install scripts. With pnpm 11's strict dependency-build handling, `true` means
that a reviewed script may run, while `false` records a reviewed denial; an
unlisted script fails installation and forces a new decision.

Keep the map limited to scripts encountered by a clean install of the current
lockfile. `esbuild` is allowed because its postinstall selects, validates, and
prepares the platform binary. `browser-tabs-lock`, `core-js`, and
`tesseract.js` remain explicitly denied because their postinstall scripts only
emit promotional or funding messages. Remove entries that are no longer
resolved or no longer expose lifecycle scripts so future dependency changes
must be reviewed instead of inheriting stale policy.

Preserve `patchedDependencies` alongside `allowBuilds` because those
repository-owned fixes are applied during installation and must survive a
package-manager change. An `.npmrc` may still exist for registry and
authentication entries, but must not contain pnpm behavioral settings.

A package-manager change can affect lockfile parsing, peer resolution, patch
application, dependency lifecycle scripts, CI, and native builds. Therefore,
update all three pins together and verify a frozen install, the full checks,
production exports, and native EAS builds.

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
