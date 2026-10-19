# Platform and Release Infrastructure Context

This context covers environments, builds, releases, EAS, CI/CD, deployment, secrets, local development, and operational workflows.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology, conventions, and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

## Language

**Diagnostic error detail**:
Internal failure context used by the Dayova team to debug production problems; it can include raw errors, stack traces, request metadata, and provider responses, but must not be shown to learners.
_Avoid_: User-facing message, learner error text

## Notes

- Expo public env vars prefixed with `EXPO_PUBLIC_` are bundled into the mobile app and must only contain public client-side values.
- `EXPO_PUBLIC_POSTHOG_API_KEY` enables PostHog analytics in the Expo app. Leave it empty to disable analytics locally.
- `EXPO_PUBLIC_POSTHOG_HOST` defaults to `https://eu.i.posthog.com`; use a Dayova-owned reverse proxy only if event delivery or privacy requirements justify the extra infrastructure.
- Analytics events must go through `src/lib/analytics.ts`. PostHog autocapture, lifecycle events, anonymous pre-auth tracking, and session replay are intentionally disabled for the validation phase.
- Clerk user ID is the PostHog `distinctId`, never a `clerk_id` property. Custom identity is exactly optional `convex_user_id`, optional `validation_student_code`, bounded `grade` (`6` through `13`), and bounded German federal `state`; the bounded product `Schulart` remains excluded as `school_type` until a separate reviewed analytics-contract change.
- Names, email addresses, birth dates, avatar URLs, school names, raw notes, filenames, uploaded content, learner answers, transcripts, and diagnostic error detail are never custom PostHog person or event properties.
- Capture platform conventions, release processes, and environment decisions here.
- Put platform ADRs in `docs/contexts/platform/adr/`.

## CI Quality Gate

Decision rationale, acceptance, and the associated cleanup/verification scope
live in the [canonical Notion decision record](https://app.notion.com/p/3fd2e87228bf81f98b45f94017f0079d).
The [code-facing reference](adr/0001-enforce-repository-checks-and-limit-typed-linting.md)
links the historical stacked-PR CI evidence.

`.eas/workflows/ci.yml` runs formatting, lint, unused code/dependencies,
repository skill validation, TypeScript, and tests in `quality`. The final
`checks` job preserves the required `Lint, typecheck, and test` context and
rejects failed or skipped applicable quality, OTA, native, and authentication
prerequisites. A merge validates the resulting `main` commit again. Opening,
reopening, or updating a PR triggers CI; marking it ready does not repeat an
unchanged commit.

Pull-request triggers cover every target branch, including stack parents. Do not
restrict them to `main`: doing so leaves new commits in dependent PRs without CI
or a current OTA compatibility report. The source and contributor trust gates
still apply, and deployment/publication remain limited to pushes to `main`.

Pull request checks require the author's GitHub association to be `OWNER`,
`MEMBER`, or `COLLABORATOR`. Manual runs validate only. Trusted same-repository
PRs also run production fingerprinting and OTA compatibility checks; Convex
deployment and OTA publication remain restricted to pushes to `main`.
OTA checks depend on `quality`; Convex deployment depends on final `checks`.
OTA publication also requires successful fingerprinting, deployment, and OTA
safety. Production exports carry file hashes and source/runtime/environment/native
fingerprint provenance. The final gate downloads and verifies the uploaded
artifact; publication reuses and revalidates it without bundling again.

Native/configuration and auth/onboarding changes select Android/iOS validation
through `scripts/ci-native-changes.mjs`. The weekly run forces it; manual CI can
set `native_checks=true`. Profile `ci` builds embedded non-production apps against
the reviewed development Clerk/Convex tenant, with updates and analytics disabled.
Matching native builds are reused only with a freshly repacked JavaScript bundle.
Maestro and the real-service auth probe use sensitive development environment
variables `MAESTRO_CI_EMAIL` and `MAESTRO_CI_PASSWORD` for a synthetic Clerk test
identity. The auth probe checks both authenticated access and anonymous denial.

`pnpm test:ci` retains per-stage timings, Vitest JUnit, and Jest JSON under ignored
`.maestro/artifacts/ci/`. Weekly CI and the manual `test-coverage.yml` collect
Vitest/Jest coverage there. Upload steps run even on failure. Manual
`test-benchmark.yml` and `export-benchmark.yml` compare worker counts and separate
versus combined exports on the same commit and runner; inspect resolved inputs
before treating a run as a matched comparison.

`Automated review coverage` reports a completed CodeRabbit review separately
from its provider status. A skipped, rate-limited, missing, or unknown result
stays pending even if the provider reports success. This informational status
does not replace the required independent reviews.

Biome owns general linting and formatting for application/backend source, root
configuration, tests, ESLint rules, scripts, plugins, and local modules. Its
coverage fixtures must reject invalid code in each of these locations. Generated
Convex files and installer-owned `skills-lock.json` remain excluded; repository
skill validation checks the latter.

ESLint owns the React Hooks/Compiler, Dayova UI, and Convex rules. The UI rules
use syntax-only parsing; Convex retains TypeScript project services because its
query and explicit-table rules require type information. Keep the integration
fixtures green when changing either boundary, and retain the independent full
TypeScript check. Knip remains the unused-code/dependency gate. Replacing an
engine requires proving equivalent coverage for its specialized rules first.

## Release Environment

The native runtime boundary, clean-build provenance requirements, verified
binary baseline, staging/promotion flow, and rollback/resumption policy live in
[`release/README.md`](../../../release/README.md). Expo SDK 57 starts at app and
runtime version `1.0.4`; never publish SDK 57 code on the distributed SDK 56
runtime `1.0.3`.

The patched SDK 57 release uses app/runtime `1.0.5` to isolate Expo 57.0.20 and
React Native 0.86.3 (including the Hermes V1 memory fix) from older native
binaries. The Metro cache-read limit, Gradle toolchain resolver removal, and
iOS update splash-screen trait patches remain required and are reapplied to
the upgraded packages through `pnpm-workspace.yaml`.

Native release builds and OTA update bundles must have these public app envs
available while Expo bundles JavaScript:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`

`app.config.cts` fails release config evaluation when either value is missing, so
a broken artifact cannot ship and crash on startup. Set these in EAS/CI for the
target environment before running production builds or publishing updates.

The mobile app reads these values through `src/lib/runtime-config.ts`, which uses
`@t3-oss/env-core` with the `EXPO_PUBLIC_` client prefix and an explicit
`runtimeEnvStrict` map so Expo bundles every required public variable.

When adding a new required public app env, add it to `publicEnvSchema` in
`src/lib/runtime-config.ts`. The app runtime fallback, tests, and
`app.config.cts` release validation all derive their required-key list from that
schema.

Keep the dynamic Expo config at `app.config.cts` and export it through
`module.exports`. The config loads the shared TypeScript runtime validator with
`require`, so the explicit CommonJS extension prevents Node and EAS Build from
classifying the config as ESM and removing `require` from its module scope. A
future ESM migration must convert the config and its imported TypeScript module
as one change and keep `tests/app-config-loading.test.ts` green under Node's
native TypeScript loader.

PostHog validation analytics envs are optional public app envs:

- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`

Do not add optional public envs to the required release-key list unless the app
cannot function without them. The analytics client must stay disabled gracefully
when the PostHog key is absent.

## SDK 58 runtime boundary

The SDK 58 / React Native 0.88 upgrade uses app/runtime `1.0.6` on both platforms.
Keep the distributed SDK 57 baseline immutable; this graph requires new native
binaries and must not be published to runtime `1.0.5`. Patch ownership and upstream
removals are documented in `patches/README.md`. The SDK upgrade retains the CI
quality gates introduced by #846; it does not replace that tooling change.

`jest-expo` 58 uses Jest 30 transforms, environments and watch plugins. Keep the
root Jest, globals and types on 30 even while Expo's version recommendation still
lists Jest 29. Only `jest` and `@types/jest` are excluded from that recommendation;
the full UI suite and dependency peer checks remain required.

Clerk 4 supports SDK 58 and exposes `__experimental_disableNativeClientSync`.
Dayova's custom JS authentication uses that provider option instead of mutating
the TurboModule registry. Do not enable native sync without introducing Clerk
native auth components and verifying session ownership on both platforms.

SDK 58 Router's `repeat()` injects a child source when a parent-targeted action
has no source. The nested-stack integration test reproduces the resulting blocked
replacement. `useBackIntent` disables prevention explicitly and dispatches the
original action through the root ref, preserving its target/source. Recheck this
workaround when Router changes; retain protection if another guard cancels removal.

## Validation Analytics Runtime Contract

Every allowed custom event receives `analytics_schema_version` and may receive
only centrally generated `validation_student_code`, `eas_update_id`,
`eas_channel`, `eas_runtime_version`, and `eas_is_embedded_launch` shared
context. The exact event-property pairs are:

- `feature_interaction`: bounded `interaction`, `outcome`, and optional `entity_id`, `value`, and `screen`
- `app_screen_viewed`: bounded `screen` selected from known route templates
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

## TypeScript Toolchain

Use stable TypeScript 7 through `@typescript/native` (an npm alias of
`typescript`) for `tsc`, local watch mode, the app and Convex CI typechecks, and
Convex CLI typechecking. Convex 1.43.0 is the minimum version that resolves this
native alias. Keep its development and deployment typechecks enabled.

Keep the root `typescript` dependency aliased to Microsoft's
`@typescript/typescript6` compatibility package while ESLint and Expo still
need the TypeScript 6 JavaScript API. It exports that API and `tsc6`; the native
alias owns `tsc`, avoiding executable conflicts. Preserve both aliases when
upgrading dependencies, and verify lint, both tsconfigs, Expo config loading,
and a frozen install. The decision and compatibility rationale live in the
[Notion developer handbook](https://www.notion.so/3dc2e87228bf818a9547f588e2cf0386).
See [README](../../../README.md#typescript-tooling) for commands, editor setup,
and timing comparisons.

## Package Manager Toolchain

Dayova uses pnpm 11.15.1 on Node 24.18.0. The pnpm version is repeated because
each install surface selects its toolchain independently: `package.json`
controls local Corepack, the shared `eas.json` profile controls native EAS
Build workers, and the files in `.eas/workflows/` control EAS Workflow jobs.
Keep those pins exact and identical so no surface falls back to a different
image default. Keep `pmOnFail: error` in `pnpm-workspace.yaml` so a mismatched
pnpm binary fails immediately instead of downloading and running another version.
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

Keep `virtualStoreDirMaxLength: 40` in `pnpm-workspace.yaml`. Native Android
dependencies add CMake build directories below pnpm's virtual store, and the
default Windows package-directory length can push those paths beyond CMake
3.22's 250-character object-path budget in deep worktrees. Forty retains
readable package prefixes where possible while leaving enough space for CMake
and Ninja's generated suffixes. This is a pnpm behavior setting and therefore
does not belong in `.npmrc`.

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

React Native caches absolute native-module paths in
`android/build/generated/autolinking/autolinking.json`. A pnpm upgrade or a
`virtualStoreDirMaxLength` change can rename the hashed virtual-store directories
without changing the package graph that Gradle's cache sentinel tracks. The
`expo:android` script therefore runs
`scripts/prepare-android-autolinking-cache.cjs` first. The preflight preserves a
valid cache and removes only `package.json.sha` when cached native source
directories no longer exist, causing React Native's Gradle plugin to regenerate
its own cache. Do not replace this with unconditional deletion of Gradle output
or `node_modules`.

The Expo/React Native plugin graph and embedded Metro bundle can exceed Gradle's
former 512 MiB metaspace ceiling during native release builds.
`plugins/withAndroidGradleJvmMemory.js` therefore keeps the generated
`org.gradle.jvmargs` in `android/gradle.properties` at 4 GiB heap and 1 GiB
metaspace. Change that plugin—not the gitignored generated file—only when a
measured build proves a different ceiling is safe. An apparent stop around
`createBundle*JsAndAssets` must be diagnosed from the Gradle and Node processes
before deleting caches; the one-shot release bundle is expected to complete
while development builds retain watch mode.

## Android Google Play Testing Releases

Google Play Internal, Closed, Open, and Production releases all use the EAS
`production` build profile. They are tracks of the same Play app and therefore
must keep package `com.dayova`, the production EAS environment, production OTA
channel/runtime, Play signing, and remote version-code auto-increment. Do not
create track-specific package names or use the preview/internal-distribution
build profiles for Play testing.

The EAS Submit profile contract is:

- `internal` → Play `internal`, released to the configured internal audience;
- `closed` → Play `alpha`, released to the configured Closed audience;
- `open` → Play `beta`, released to the configured Open audience; and
- `production` → Play `production` as a draft, preserving a separate human
  rollout decision.

`.eas/workflows/android-play-test.yml` is the checked path for a new Closed or
Open candidate. It runs the normal repository checks, builds a production AAB,
shows immutable build provenance, requires approval, and only then submits to
the selected test track. Prefer Play Console promotion when moving an already
accepted Closed artifact to Open so the exact tested version code is retained;
running the Open workflow creates a new candidate that must be validated again.

Tester audiences, opt-in links, Open countries/cap, and promotion remain Play
Console state and must not be encoded as secrets or personal data in Git. The
operator runbook is `release/google-play/testing-tracks.md`.

## iOS Privacy Purpose Strings

Dayova uses camera/photo upload for learning material. Keep these App Store
privacy purpose strings in `app.config.cts`. If a local native
`ios/Dayova/Info.plist` exists after prebuild, keep it in sync too:

- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`

Learning-session answers are typed or selected. The image-picker plugin sets
`microphonePermission: false`, so native builds must not request microphone or
speech-recognition access.

`tests/ios-privacy-config.test.ts` always guards `app.config.cts` and also
checks the generated native plist when it exists. Run it before an iOS release
build so App Store Connect does not reject the uploaded bundle for missing
purpose strings.

## iOS Deployment Target

SDK 58 generates an iOS 16.4 application deployment target in both the Xcode
project and the Podfile default. Clerk 4's JavaScript authentication package no
longer includes the native Clerk pod that raised the SDK 57 application target
to iOS 17.0. Its config plugin applies native SDK configuration only when the
optional `@clerk/expo-native-components` package is installed; Dayova does not
install that package.

Keep Dayova-owned native modules compatible with Expo's 16.4 baseline unless a
higher target is intentional and documented. Recheck the generated application
target when adding native authentication components. The deployment target is
not evidence of runtime verification on iOS 16.4; the SDK 58 native smoke and
appearance evidence covers iOS 27 simulators.

See `modules/dayova-system-appearance/README.md` for the appearance module's
runtime design, React Native coupling, compatibility policy, test matrix, and
removal criteria.
