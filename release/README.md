# Native release and production OTA policy

`production-ota-baseline.json` records the exact production binaries that are
known to be distributed for each platform. The automatic production OTA workflow
compares the current manifest and phase-equivalent EAS fingerprints with this
manifest. It never infers safety from the previous Git commit.

## Runtime boundary

The current app/runtime boundary is **1.0.5**. The September 2026 patch upgrade
uses Expo 57.0.20, React Native 0.86.3, Reanimated 4.5.1, and Worklets 0.10.1 to
remove the [Hermes V1 memory regression](https://expo.dev/changelog/sdk-57#known-regressions).
These native dependencies require a new store binary; do not send its JavaScript
to existing 1.0.4 binaries. Both platforms resolve 1.0.5 even when only Android
is being built. Keep the distributed-binary baseline unchanged until the exact
replacement binaries satisfy the verification requirements below.

The original SDK 57 migration created an app/runtime boundary at `1.0.4`; the already
distributed SDK 56 binaries remain on runtime `1.0.3`. Future native changes
must either cut another runtime boundary or document why the existing runtime
remains compatible.
EAS Update only selects updates whose runtime matches the binary, so an SDK 57
update published with runtime `1.0.4` is ineligible for every `1.0.3` binary.

The app version must agree in `app.config.cts` and `package.json`. Both platforms
must resolve the same runtime. Production identifiers remain `de.dayova.app` and
`com.dayova`.

## Clean build provenance

`eas.json` sets `cli.requireCommit` to `true`. Do not disable it or use a no-VCS
upload for production. Before starting a production build:

1. commit the complete release source;
2. verify `git status --short` is empty;
3. build with the `production` profile, which fixes `APP_VARIANT=production`, the
   production EAS environment, Node, and pnpm versions; and
4. record the EAS build ID, store build number/version code, full Git SHA,
   runtime, SDK version, channel, production identifier, and native fingerprint.

The EAS build itself must report that same Git SHA. A successful build from an
uncommitted upload is not acceptable provenance.

## Phase-equivalent fingerprints

The production workflow uses EAS's CNG-aware `fingerprint` job with the
`production` environment. Its iOS and Android outputs are the only accepted gate
inputs. This is the same EAS-supported phase used to match CNG builds and avoids
comparing a pre-prebuild checkout hash with a build fingerprint containing a
generated `bareNativeDir`.

Do not replace the workflow outputs with `expo fingerprint:generate` from the
normal checkout and do not set `unstable_skip_cng_check`. Missing fingerprint
outputs are classified as a preflight failure and block publication. A valid but
different fingerprint is classified as native incompatibility and also blocks.

## Verifying and replacing the baseline

Only mark a platform's distribution as `verified` after the intended audience can
actually install that exact build. A finished EAS build or store upload alone is
not distribution evidence. Inspect the downloaded store artifact as well and
record that its embedded update uses the build's runtime and production channel.

Schema 2 requires global app/runtime/SDK values and, for both platforms:

- exact build ID, build number/version code, source SHA, and fingerprint;
- app identifier, app version, runtime, SDK version, and channel;
- verified distribution evidence and audience; and
- verified embedded-update evidence and runtime.

Replace both platform entries atomically only after both exact binaries are
verified. Until then, keep the previous baseline unchanged; the schema/runtime
mismatch deliberately keeps automatic production publication closed.

The guard can be reproduced with known EAS fingerprint outputs:

```sh
pnpm exec cross-env \
  APP_VARIANT=production \
  OTA_IOS_FINGERPRINT="<eas-ios-fingerprint>" \
  OTA_ANDROID_FINGERPRINT="<eas-android-fingerprint>" \
  node scripts/ota-safety.mjs
```

On macOS, a large cold export may exceed the native filesystem watcher's file
limit. Install Watchman and opt into it for that one export or local update
publish without changing EAS worker behavior. If an all-platform export still
exceeds the process limit, export or publish iOS and Android sequentially:

```sh
DAYOVA_METRO_USE_WATCHMAN=true pnpm exec expo export --platform ios
DAYOVA_METRO_USE_WATCHMAN=true pnpm exec expo export --platform android
```

## Android release handoff — 7 September 2026

The submitted Android candidate is app/runtime **1.0.5**, version code **23**,
EAS build `b8c2cdc4-076f-4569-90e2-6135fdb4bbe8`, from source
`f1aff0f53708ca45b884100a8693a0209b983e2a`. The
[candidate audit](./google-play/release-candidate-audit.md) records the signed
AAB, fingerprint, embedded update, and submission provenance from
[PR #545](https://github.com/Dayova/dayova-mvp/pull/545).

At the September 7 submission confirmation, Internal testing had build 23
available; Production, Open testing, and Closed Alpha rollouts plus resuming
Open testing were sent for review. Germany targeting was preserved and Managed
publishing was off. Approval, public availability, and Play install/billing QA
were not yet verified. Recheck Console before taking further release actions;
submission is already recorded and must not be repeated from this handoff.

Android builds 20 and 21 and the August iOS 1.0.4/build 55 record are historical
provenance, not candidates for the 1.0.5 baseline. Keep the distributed OTA
baseline unchanged until both exact replacement binaries meet the requirements
below. Follow the [Google Play command center](./google-play/README.md) and
[testing runbook](./google-play/testing-tracks.md) for the remaining handoff.

## Staging, promotion, and rollback

Build dedicated internal QA binaries for both platforms with the `ota-staging`
profile from the exact release source. This profile uses production app config
and EAS environment but embeds the isolated `ota-staging` channel. Publish the
candidate to that channel, verify the result reports runtime `1.0.5`, and record
the update ID actually downloaded by each QA binary. Do not remap the production
channel or publish/republish to it for staging.

The staging builds prove the new-runtime update path without exposing production
binaries. They are not substitutes for installing and checking the exact store
artifacts, and their native fingerprints differ because the embedded channel is
part of native configuration. After the exact production binaries are
distributed and install-verified, the schema 2 baseline lands, and the main
workflow is green, the automatic production job creates the production update
from that exact main commit.

If a production OTA is unhealthy:

1. stop rollout expansion and record the affected update group;
2. prefer `eas update:rollback <latest-group-id> --platform all` when the prior
   update or embedded update is known to be state-compatible;
3. otherwise fix forward on the same runtime; and
4. verify both platforms and update insights before resuming rollout.

Never republish an update across runtime versions. Persistent-data migrations
must be backward compatible with the selected rollback target.

## When automatic production OTA may resume

Automatic publication may resume only after all of the following are true:

- both replacement store binaries are distributed and install-verified;
- their clean-source provenance and embedded updates are recorded in one schema 2
  baseline change;
- the EAS production fingerprint job matches both exact builds;
- a runtime `1.0.5` update succeeds on dedicated `ota-staging` iOS and Android
  QA builds, with both downloaded update IDs recorded;
- a deliberately mismatched native fingerprint still fails closed; and
- the baseline change lands on `main` and the complete main workflow is green.

Release evidence is tracked in
[DAY-248](https://linear.app/dayova/issue/DAY-248/separate-the-expo-sdk-57-runtime-before-the-next-native-release).
