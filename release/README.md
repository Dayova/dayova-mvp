# Native release and production OTA policy

`production-ota-baseline.json` is the compatibility record used by the production
OTA guard. Its schema-2 entries record the verified internal production-channel
builds iOS 75 and Android 25; it is not an inventory of every store track. The workflow
compares the current manifest and phase-equivalent EAS fingerprints with this
manifest. It never infers safety from the previous Git commit.

The [September 16 live verification](./live-verification-2026-09-16.md) confirms
Android 1.0.5/code 23 on Play and Apple listing 1.0 with binary 1.0.4/build 72.
It also records live privacy-declaration/link problems and billing configuration.
Store availability alone does not satisfy the baseline's installed-artifact checks.

The [later September 16 activation evidence](./ota-activation-2026-09-16.md)
records iOS 75 and Android 25 signed-artifact inspection, physical installation
and cold-launch checks, and direct running-staging-update evidence on both
platforms. Before merging baseline activation, run the manual
`.eas/workflows/ota-preflight.yml` against the release candidate and require matching
production CNG fingerprints and both platform exports. After success, only
evidence/documentation changes may reuse that result: verify their diff changes
no app, dependency, native input, script or workflow. Any such input change needs
a new preflight and appropriate staging validation. This workflow publishes
no updates. The main push workflow rechecks compatibility before publication.
The September 17 initial preflight exposed test-tooling-only input drift. The
baseline now records exact reviewed equivalents separately from the immutable
build fingerprints; see the linked audit. The integrated candidate passed both
staging launch checks and the cloud preflight on September 17. Merge-source
CI and compatibility checks must still succeed before production publication.

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

### Pull request feedback

CI checks OTA compatibility before merge for trusted contributors' PRs targeting
`main` from this repository. After lint, typecheck and tests pass, the same
production fingerprint and OTA jobs used on `main` verify both platform exports
and compare the candidate with the distributed-binary baseline. Fork PRs do not
run the production-scoped quality-check, fingerprint, or OTA jobs, including
forks opened by repository owners, members, or collaborators.

The **PR OTA compatibility report** in the EAS workflow shows the checked commit,
run link, result, reason, baseline and fingerprints, including an explicit
unconfirmed result when an upstream job fails or is skipped. The native EAS
`github-comment` job posts that same rendered report to the PR conversation using
the existing GitHub integration.

Expo updates one PR comment across runs. The report puts its checked commit and
EAS run link at the top and explicitly says that its verdict applies only to
that commit. If the PR head differs, the visible result is outdated and OTA
compatibility for the latest commit is unconfirmed until Expo updates the
comment. A canceled run can leave the previous result visible, so reviewers
must compare the checked commit with the live PR head before merging.

The GitHub Actions token cannot edit Expo's comment. The previous notifier
attempted that edit and failed with HTTP 403; it was removed to keep OTA
feedback in a single comment. The **OTA report freshness** commit status marks
the current PR head pending while Expo's report covers an older commit, then
marks it current when the Expo bot updates its comment. A current status only
confirms that the report covers the head; reviewers must still read the OTA
verdict. The status workflow does not create or edit PR comments.

Incompatibility is advisory: a legitimate native change can merge, but
production OTA remains blocked until the required
native release or exact reviewed compatibility record is verified. Export or
preflight execution errors fail the check rather than masquerading as a completed
compatibility assessment.

PR results describe the checked source and baseline; they do not authorize a
release or prove device behavior. The merged `main` commit must pass the checks
again before publishing. Manual CI runs remain quality-only; use
`ota-preflight.yml` for a manual, non-publishing production assessment.

### Gate inputs

The production workflow uses EAS's CNG-aware `fingerprint` job with the
`production` environment. Its iOS and Android outputs are the only accepted gate
inputs. This is the same EAS-supported phase used to match CNG builds and avoids
comparing a pre-prebuild checkout hash with a build fingerprint containing a
generated `bareNativeDir`.

Do not replace the workflow outputs with `expo fingerprint:generate` from the
normal checkout and do not set `unstable_skip_cng_check`. Missing fingerprint
outputs are classified as a preflight failure and block publication. A valid but
different fingerprint blocks unless the same platform/build baseline contains
that exact hash in `reviewedCompatibleFingerprints`. Such a record must bind the
original build fingerprint, full audit source SHA and evidence of an EAS source
comparison showing native equivalence. Never overwrite a build's actual hash,
ignore input classes globally or approve an unknown future fingerprint. Missing
or malformed review records fail closed. Success reports explicitly identify
when reviewed equivalence was used; all manifest, runtime, SDK, channel,
distribution and embedded-update checks still apply.

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
APP_VARIANT=production DAYOVA_METRO_USE_WATCHMAN=true pnpm exec expo export --platform ios
APP_VARIANT=production DAYOVA_METRO_USE_WATCHMAN=true pnpm exec expo export --platform android
```

These exports also require the production public environment variables described
in [the platform context](../docs/contexts/platform/CONTEXT.md).

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

Subsequent evidence: [DAY-248](https://linear.app/dayova/issue/DAY-248) records
the owner's September 15 report that Google is live and Apple has approved iOS
1.0.4/build 72. On September 16, authenticated EAS metadata independently
confirmed Android build 23's version, runtime, source, channel, fingerprint,
artifact URL, and completion time; see the [candidate audit](./google-play/release-candidate-audit.md).
The subsequent signed-in browser audit confirmed all four Play tracks active
with code 23 and Apple distribution in Germany, Austria, and Switzerland; see
the [live evidence](./live-verification-2026-09-16.md). Installation and billing
lifecycle QA remain outstanding. Existing iOS
1.0.4 cannot receive the upgraded native stack over OTA. Reuse Android build 23
only if the reconciled production candidate's fingerprint matches; obtain the
matching iOS native binary and installation evidence under DAY-248.

Android builds 20 and 21 and the August iOS 1.0.4/build 55 record are historical
provenance, not candidates for the 1.0.5 baseline. Keep the distributed OTA
baseline unchanged until both exact replacement binaries meet the requirements
below. Follow the [Google Play command center](./google-play/README.md) and
[testing runbook](./google-play/testing-tracks.md) for the remaining handoff.

## Staging, promotion, and rollback

Build dedicated QA binaries from the exact release source. Use `ota-staging`
for an Android APK or an iOS ad-hoc build when a suitable provisioning profile
and registered devices are available. For iOS TestFlight, use
`ota-staging-testflight`: it inherits production signing and automatic build
number increments while embedding the isolated `ota-staging` channel. Submit
that exact build ID with the existing `production` submission profile and keep
it in the internal testing group; never select a staging build for App Store
distribution. `ota-staging-simulator` provides an unsigned iOS simulator build
for automated OTA checks without consuming a new store build number. All three
profiles use production app config and EAS environment. Publish the candidate
to that channel, verify the result reports runtime `1.0.5`, and record
the update ID actually downloaded by each QA binary. Do not remap the production
channel or publish/republish to it for staging.

Changes to `eas.json` can change fingerprints even when native code is unchanged.
Recompute the final candidate and never copy older build hashes into a baseline
to bypass that mismatch. Integrate DAY-414's publication and channel-verification
runbook changes before activation.

The staging builds prove the new-runtime update path without exposing production
binaries. They are not substitutes for installing and checking the exact store
artifacts. Inspect each artifact's embedded channel separately: the EAS CNG
fingerprint can be identical across production and staging profiles and does
not prove which channel a binary requests. After the exact production binaries are
distributed and install-verified, the schema 2 baseline lands, and the main
workflow is green, the automatic production job creates the production update
from that exact main commit. The workflow validates separate iOS and Android
exports with their platform-specific production environment checks. After the
guard and Convex deployment succeed, `scripts/publish-production-ota.mjs`
checks the clean checkout against the triggering main SHA, exports both
platforms together, reruns the compatibility guard, and verifies that the live
production channel is active and points exclusively to branch `production`.
It atomically creates the reserved, empty EAS branch `production-publication-lock`
before publishing and rechecks the channel while holding that lock. EAS rejects
duplicate branch names, so concurrent or later publishers cannot proceed while
the lock exists. Keep this branch empty and never map a channel to it. The job
logs its lock ID and source SHA, then publishes the already-exported bundle once
with pinned EAS CLI 18.11.0,
`--platform all --skip-bundler --environment production`. A failed export or
preflight prevents either platform from publishing. PR/manual paths cannot
enter the publication job. The baseline-activation merge can itself publish,
so staging and workflow readiness must precede it.

Schema 2 deliberately requires one shared runtime. Existing iOS 1.0.4/build 72
and Android 1.0.5/build 23 cannot be combined in that baseline. Relabelling
iOS as 1.0.5 does not change its native stack or fingerprint.

The publication log records the raw CLI response and then a verified summary
containing each platform's update ID, common group ID, runtime, and source SHA.
Success requires exactly one iOS and one Android update on branch `production`
with the intended runtime and commit. A CLI/network failure can leave the server
state uncertain even when no valid summary is returned. The publisher removes
the lock only after verifying the complete both-platform response. An uncertain
acquisition, publication failure, or workflow cancellation leaves the server-side
lock in place, blocking later jobs even if the original worker never runs its
error handler. Lock removal failure also requires inspection. Never automatically
retry or clear an existing lock. To recover:

1. stop all production publishers and wait for every worker to terminate;
2. inspect the recorded lock ID and production groups by source SHA, recording
   whichever platforms were published; a lost response can mean both succeeded;
3. choose and verify recovery for the actual published state using the rollback
   procedure below; and
4. only after recovery is verified and no publisher remains active, delete the
   reserved empty branch with
   `pnpm exec cross-env APP_VARIANT=production pnpm dlx eas-cli@18.11.0 branch:delete production-publication-lock --json --non-interactive`.
   Verify the returned ID is the inspected lock. Never delete/recreate the lock
   while a worker is active: the CLI resolves deletion by name. If creation was
   not confirmed, inspect EAS first; do not assume an empty log means no lock or
   no publication. Then permit a new reviewed main run.

If only one platform is live, use the rollback procedure below for that affected
platform/group or a reviewed same-runtime fix; verify both platforms afterward.
One CLI call reduces split publication risk but is not a cross-platform rollback
transaction. Preserve its logs even if post-publication validation fails.

An update being published, downloaded, and launched are separate events. Record
the update UUID actually running after a cold restart on each staging and store
binary. A downloaded update does not prove the app has launched it, and a
successful EAS job does not prove either device event.

To inspect the running UUID on a device, open **Einstellungen → App-Informationen**.
Before sign-in, tap the **Dayova** heading on the welcome screen instead. Record
the build, channel, runtime, **Quelle**, **Laufendes Update** and **Notfallstart**
after a cold restart. The dialog reads `Updates.updateId` and
`Updates.isEmbeddedLaunch`; it does not display an available/downloaded candidate
as though it were running. It is read-only and sends no diagnostic data.

If a production OTA is unhealthy:

1. pause further production publications and record the affected branch, update
   group, runtime, and platforms. The current workflow does not set a staged
   rollout percentage; do not assume there is an expansion phase to stop;
2. when a prior update or the embedded update is known to be state-compatible,
   run `pnpm exec cross-env APP_VARIANT=production pnpm dlx eas-cli@18.11.0 update:rollback`
   and use its interactive selection flow. Verify the production branch, runtime,
   affected platforms, and known-good target before confirming. This command
   accepts neither a positional update-group ID nor `--platform`;
3. for an explicitly scripted recovery, use the supported `update:republish`
   command with the known-good `--group`, or `update:roll-back-to-embedded`,
   after checking their pinned CLI help and selecting the exact scope;
4. otherwise fix forward on the same runtime; and
5. verify download and launch on each affected platform before resuming
   production publications.

See [Expo's rollback guide](https://docs.expo.dev/eas-update/rollbacks/).

Never republish an update across runtime versions. Persistent-data migrations
must be backward compatible with the selected rollback target.

## When automatic production OTA may resume

Automatic publication may resume only after all of the following are true:

- both replacement store binaries are distributed and install-verified;
- [DAY-414](https://linear.app/dayova/issue/DAY-414)'s iOS and Android exports,
  guarded publication, and partial-publication recovery are implemented and
  validated while the old baseline still blocks production;
- the live production channel-to-branch mapping is verified;
- their clean-source provenance and embedded updates are recorded in one schema 2
  baseline change;
- the final-source EAS production fingerprint job matches each exact build's
  original hash or its exact, independently reviewed native-equivalence record;
- a runtime `1.0.5` update is downloaded and launched after a cold restart on
  dedicated QA builds targeting the `ota-staging` channel: Android uses the
  `ota-staging` profile; a physical iPhone uses `ota-staging-testflight` or the
  ad-hoc `ota-staging` profile. Record the downloaded and running update UUIDs
  for both platforms. An `ota-staging-simulator` check is supplementary and
  does not replace the iPhone check or exact store-artifact installation checks;
- a deliberately mismatched native fingerprint still fails closed; and
- the baseline change lands on `main` and the complete main workflow is green.

Release evidence is tracked in
[DAY-248](https://linear.app/dayova/issue/DAY-248/separate-the-expo-sdk-57-runtime-before-the-next-native-release).

As checked September 16, the active production channel maps to branch
`production`; its latest published group is still July 17's runtime `1.0.3`.
Recheck the mapping at activation. This finding does not enable publication or
make that update compatible with the current store binaries.
