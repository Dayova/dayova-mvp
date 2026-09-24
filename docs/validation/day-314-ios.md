# DAY-314 iOS validation

Validation on 2026-09-09 for draft [PR #556](https://github.com/Dayova/dayova-mvp/pull/556).

## Host and isolated device

- macOS 26.6.2 (25G83), Apple Silicon, 8 GB RAM; Xcode 26.6 (17F113).
- Disposable iPhone 17, iOS 26.5 (23F77), default portrait/display/text settings.
- Simulator: `31E64845-D619-4F47-B4AF-23831A5C16AC`, named `DAY-314-disposable`.
- Maestro 2.10.0 (official release ZIP SHA-256
  `29b675e10cc12080e445e9bfb2e2b4e4dfb9c0f2e30d5884120d258b5e1cd991`),
  OpenJDK 17.0.20.1, Node 24.18.0, pnpm 11.15.1.
- No learner account was used. Only the disposable simulator's Keychain was reset.

## Artifact configuration

App source: `dfc95ef50d32ed26fff15f41a0bfa33ad2a5c451`.
Native generation used the frozen lockfile and `APP_VARIANT=preview`.
The final Release artifact targets arm64 iOS Simulator with Xcode simulator
signing enabled: `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`.
The app ID is `de.dayova.app-dev`; app/runtime version is 1.0.4.

Configuration was exported explicitly with `EXPO_NO_DOTENV=1` and
`EAS_BUILD_PLATFORM=ios`:

- Clerk test instance: `https://warm-parrot-13.clerk.accounts.dev` (`pk_test_`).
- Convex: `https://kindred-canary-599.eu-west-1.convex.cloud`.
  The authenticated Convex deployment metadata API returned `deploymentType: dev`,
  reference `dev/jakob-rossner`; its `CLERK_JWT_ISSUER_DOMAIN` matches the test key.
- PostHog public key: empty, disabling analytics.
- Legal URLs: public EAS preview configuration. RevenueCat public store keys:
  public EAS production configuration, required by release validation. RevenueCat
  initializes only on the subscription screen with an authenticated user; this
  flow never reaches it or makes purchases.
- EAS preview currently points to a different Convex deployment and lacks the
  required RevenueCat public keys. Its label was not used as proof of isolation.
- OTA disabled by setting `EXUpdatesEnabled=false` in the generated, ignored
  `ios/Dayova/Supporting/Expo.plist` after prebuild. No EAS profile or tracked
  app configuration was changed. This artifact tests embedded startup, not OTA
  delivery through the preview channel.

The Release build succeeded. Artifact inspection confirmed `iPhoneSimulator`,
arm64, build number 1, the expected public configuration in the embedded Hermes
bundle, the absence of the local PostHog key, and `EXUpdatesEnabled=false`.

SHA-256:

- `Dayova`: `13b5917b404d1f751a2200e7117a71c9487a30a14ee4b333f0ae8d74ed3f4803`
- `main.jsbundle`: `af8cf08d7c686cc06fba509cc509a1a48b3a3dbad4a55685b437e5b904c26ab2`

Resolved native dependencies include Clerk iOS 1.3.2 (Swift package revision
`d41365666ac3be138737a57b33b30b6291b5c65b`). `Podfile.lock` and
`Package.resolved` are retained with the evidence.

## Artifact setup investigation

The initial `CODE_SIGNING_ALLOWED=NO` artifact installed and launched, but stayed
blank. The unchanged flow failed its 60-second welcome assertion (JUnit 82.908 s
overall). Native logs showed Clerk Keychain failures with `OSStatus -34018`.
A manual signature with iOS Keychain entitlements was rejected at launch by the
simulator (JUnit 12.163 s). Both failed runs are retained as `preview-1/` and
`preview-signed-1/`.

The incremental repair used Xcode
`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`. Xcode generated the simulated
application identifier `LW6MC9ZXPC.de.dayova.app-dev` in
`Dayova.app-Simulated.xcent`; ordinary signature entitlements are empty.
`SKIP_BUNDLING=1` retained the already-built embedded bundle during this
signing-only repair; its SHA-256 remained identical. The reproducible recipe
in `docs/testing.md` enables signing from the start and performs full bundling.

## Runtime evidence

### Embedded preview runs

With Maestro 2.10.0 on PATH, each run used:

```sh
pnpm test:smoke:ios --device 31E64845-D619-4F47-B4AF-23831A5C16AC
```

| Evidence directory | JUnit suite time | Exit | Result |
| --- | ---: | ---: | --- |
| `preview-animation-1/` | 16.387 s | 0 | Passed |
| `preview-animation-2/` | 15.836 s | 0 | Passed consecutively, resetting from Login |
| `controlled-failure/` | 34.015 s | 1 | Failed only the appended missing-control assertion |

Both successful runs reset app storage and the disposable simulator Keychain,
skipped the development-client helper, and passed every German accessibility
assertion. Welcome and Login screenshots were inspected. On this 402 × 874-point
viewport, `LOGIN` and `Jetzt registrieren` were already 100% visible, so both
`scrollUntilVisible` steps completed without a swipe. This verifies their visible
target behavior; it does not establish smaller-screen scrolling coverage.
The simulator TCC database records all 13 app entries with `auth_value=0`
(denied); no permission dialog blocked the flow (`preview-permissions.txt`).

The original flow on the correctly signed artifact reached welcome but one
initial Login tap did not navigate (`preview-xcode-signed-1/`). A separate tap
from the settled screen passed. The shared flow now waits up to five seconds
for welcome animations to settle before the screenshot and tap; the two complete
runs above then passed. The welcome controls use staggered entrance animations.
This is a bounded UI-stability wait, not a fixed sleep or a relaxed assertion;
the existing 15-second `Willkommen` assertion remains mandatory.

The negative probe appended `assertVisible: DAY-314 controlled missing control`
after every real assertion and the final screenshot. JUnit recorded one failure
with that exact message, the CLI returned 1, and the failure screenshot showed
the real Login screen. An exit trap restored the real flow, verified byte-for-byte.
The probe and logs are retained as `negative-probe.sh` and `negative-probe.log`.

After development-client validation, Metro was stopped and the identical Release
artifact reinstalled. The first final attempt (`preview-final-1/`, exit 1,
JUnit 308.270 s) overlapped host clamshell sleep. `pmset -g log` records sleep at
18:55:53 and wake at 19:00:41 CEST (288 seconds); XCUITest's device-info request
timed out across that interval. The failed screenshot shows the launch splash.
The installed executable, bundle, Info.plist and Expo.plist still matched the
recorded Release hashes. The failed report and `host-sleep.txt` are retained.
No assertion or timeout was changed for the subsequent reruns.

The final shared flow then passed **twice consecutively** without Metro or
`DEV_SERVER_URL`: `preview-final-retry-1/` in 39.874 s and
`preview-final-retry-2/` in 28.682 s, each exit 0. The second reset directly from
the preceding Login screen. Both JUnit reports have one test and zero failures.
The second screenshot pair was inspected: welcome actions and all Login controls
are visible; its welcome logo/background imagery is also absent in this still
capture, extending the DAY-194 observation beyond the SE viewport. All 13 TCC
entries remain denied (`preview-final-permissions.txt`).

The final controlled assertion probe (`controlled-failure-final/`) passed every
real journey step, then failed only `DAY-314 controlled missing control` in
49.996 s with CLI exit 1 and one JUnit failure. Its failure screenshot was
inspected on Login. `negative-probe-final.log` records byte-for-byte restoration
of the real flow after the probe.

A supplemental run used a second disposable iPhone SE (3rd generation),
375 × 667 points, iOS 26.5 (23F77), named `DAY-314-scroll-disposable`, UDID
`6DE699FF-09A7-4933-83E8-ED3D7EBB3FD1`. The same artifact and unchanged flow
passed with exit 0 and JUnit 136.939 s (`preview-scroll/`):

```sh
pnpm test:smoke:ios --device 6DE699FF-09A7-4933-83E8-ED3D7EBB3FD1
```

The log records an actual upward swipe at 18:31:12 local time to reveal
`Jetzt registrieren`, then 100% target visibility and a successful Login
screenshot. Both screenshots were inspected. This closes the smaller-viewport
scrolling evidence gap. The run overlapped native compilation on the 8 GB host;
its longer time is retained rather than represented as a normal baseline.
The SE welcome capture also shows legal copy overlapping the bottom of Login
and absent logo/background imagery. These are recorded under
[DAY-194](https://linear.app/dayova/issue/DAY-194) for compact-phone visual
coverage. This cold-run still image does not establish whether the missing
imagery persists after settling. The functional smoke pass is not full visual
layout acceptance; no app layout code was changed here.

### Development client

The same generated non-production native project was built with the frozen
dependencies using `APP_VARIANT=development`, `NODE_ENV=development`, and:

```sh
xcodebuild -workspace ios/Dayova.xcworkspace -scheme Dayova \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .maestro/artifacts/day-314-ios/DerivedData -jobs 4 \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```

It succeeded and was installed on the disposable iPhone 17. The Debug artifact
has no embedded app bundle; its app/runtime version is 1.0.4, ID is
`de.dayova.app-dev`, and updates remain disabled. SHA-256:

- `Dayova`: `bc42e6bf18a783eabe9b8bd6afd9e90e9d2758109122cb5136cc74b153c2c5c3`
- `Dayova.debug.dylib`: `6eddb83ff074096e25b8479b49db7ceb83dce304bec2d62d5854fd1bd74cec4d`

Metro used the same explicit test environment with `EXPO_NO_DOTENV=1`:

```sh
EXPO_NO_DOTENV=1 APP_VARIANT=development NODE_ENV=development pnpm exec expo start --dev-client --port 8095 --max-workers 2
```

The development manifest identified this checkout's absolute project root.
Its iOS launch asset was fetched and inspected before the smoke runs, warming
Metro's bundle cache. The 29,281,692-byte bundle contains the expected Clerk test
key and Convex dev URL; SHA-256 is
`507965433648c39ff1c0d54285a740ff00634744f7b8666a63c370de87043390`.
`metro-provenance.json` retains the exact launch-asset URL and manifest metadata.
This proves the served source/configuration, not cold Metro transform latency.

A fresh-launcher probe passed `Development Build` readiness in JUnit 18.917 s
after clearing app state/Keychain, and captured `development-launcher.png`.
Evidence: `launcher-probe/`. Full helper runs use:

```sh
pnpm test:smoke:ios --device 31E64845-D619-4F47-B4AF-23831A5C16AC -e DEV_SERVER_URL=http://127.0.0.1:8095
```

The first full development-client attempt failed at `Login|Reload` (JUnit
82.033 s, exit 1): iOS displayed `Open in “Dayova”?`. The shared flow now
conditionally accepts that specific system prompt. The pending failed-run
dialog survived an app reset and blocked a subsequent launcher check
(`dev-client-confirm-1/`); it was dismissed once with `cancel-stale-link.yaml`
before testing the fix. System UI was English; Dayova's selectors were German.

With confirmation handling, `dev-client-fixed-1/` and `dev-client-fixed-2/`
passed in 54.445 s and 35.143 s, including the first Open confirmation and
developer-menu Close action. However, the native onboarding preference was
absent: iOS SDK 57's controller checks the decoded **inner server URL**, not
the outer development-client link. The flow now includes `disableOnboarding=1`
on both URLs, preserving Android compatibility. An intermediate YAML expression
was rejected at parse time and corrected to a folded scalar before execution
(`dev-client-onboarding-parse-error/`).

The final shared flow passed consecutively in `dev-client-onboarding-1/`
(36.935 s) and `dev-client-onboarding-2/` (31.598 s), each exit 0. The second
started from the previous Login screen. Both native preference files confirm
`EXDevMenuIsOnboardingFinished: true`; both logs record Reload menu detection,
tapping Close, and all app assertions. Sanitized preference snapshots are
retained with each run. Welcome/Login screenshots are retained for both runs.
The second run's screenshot pair was visually inspected: the full menu is
dismissed; SDK 57's floating developer-menu shortcut remains above the app.

### Evidence retention

Local evidence is under `.maestro/artifacts/day-314-ios/`, ignored by Git.
Build/configuration evidence includes `prebuild.log`, `pods.log`,
`build-release.sh`, `build-release.log`, `convex-provenance.json`, and
`convex-clerk-issuer.txt`. Environment files contain public configuration and
are not committed.

The curated [day-314-ios-evidence.zip](https://uploads.linear.app/25636614-9b48-4853-ae2c-f1d96a015b4e/22067d6a-8d1e-495e-bb52-ccf0bd45705b/b5981bb3-5d0a-443a-9d73-df6d7c6279cd) attachment on
[DAY-314](https://linear.app/dayova/issue/DAY-314) contains JUnit reports,
screenshots, command results, sanitized provenance, native dependency locks and
a per-file SHA-256 manifest. Raw environment files and device logs are excluded
from the shared archive. The locally built Release and Debug `.app` directories
remain under `DerivedData/Build/Products/` in the local evidence root.
The archive is 7,534,425 bytes (152 evidence files); SHA-256:
`f75149c51e7cc0bc7dc58866fc0e5a69770d60583bce55010a781ac4d791284a`.

## Repository checks

`pnpm check` passed. The first `pnpm test` run failed two existing five-second
OTA/configuration tests under concurrent setup load (713/715 Vitest tests passed).
The unmodified full retry passed: 715 Vitest + 17 tooling + 204 Jest = 936 tests.
Logs: `check.log`, `tests.log`, `tests-retry.log`. The load-related timeout is
already tracked in [DAY-380](https://linear.app/dayova/issue/DAY-380).
Final `pnpm check` also passed (`check-final.log`). Application source remained
unchanged; the fixes only affect the shared flow and documentation.

## Standards review

Independent review of the PR and scoped iOS fixes found no outstanding standards
violations. Final whitespace checks passed.

## Spec review

Independent DAY-314/task review found no outstanding implementation or scope
findings. App assertions and real welcome-to-Login navigation remain mandatory.

Review totals: Standards 0; Spec 0.

## Limits and cleanup

- English iOS system prompts were tested; app accessibility selectors are German.
- Metro was warmed before the development-client runs. OTA delivery and EAS
  automation remain outside this local embedded-startup validation (DAY-312 and
  DAY-316). Authenticated journeys remain in DAY-321.
- Android's two successful runs belong to the previous `dfc95ef` validation;
  Android was not rerun during this macOS iOS work.
  The [subsequent Windows check](day-314-android-followup.md) validates the final
  shared flow on Android and reviews the retained iOS evidence.
- DAY-194 retains the visual observations; this smoke flow does not certify
  every layout or the temporal behavior of welcome imagery.
- Both owned disposable simulators were shut down and deleted. The owned Metro
  server on port 8095 and temporary `caffeinate` process were stopped. Native
  builds completed. Personal simulators and user-wide Keychain settings were
  preserved. Cleanup verification is retained in `cleanup.json`.
- No EAS automation, backend deployment, learner sign-in, or PR merge occurred.
