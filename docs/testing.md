# Testing

Dayova uses two complementary test environments:

- `pnpm test:unit` runs Vitest for pure functions, Convex behavior, adapters,
  and ESLint `RuleTester` architecture rules.
- `pnpm test:ui` runs Jest with `jest-expo` and React Native Testing Library for
  rendered component behavior and accessibility queries.
- `pnpm test` runs both suites in that order.

Prefer observable behavior over source scanning for new or modified contracts.
Pure transition and validation logic should be extracted into small modules;
native rendering, controls, labels, and lifecycle interactions belong in
`*.ui.test.tsx`. Source-file tests remain appropriate for assets, configuration,
and generated artifact contracts that have no runtime behavior to render.

Automated tests do not replace phone/tablet acceptance evidence. Auth session
persistence, remote revocation, keyboard layout, and platform-native surfaces
must be verified on the devices named by the relevant Linear issue.

## Native launch smoke test

The shared [Maestro flow](../.maestro/flows/app-launch.yaml) launches a packaged
non-production app from clean local state, checks the welcome actions, opens
Login, and checks the email/password fields and login/recovery/registration
controls. It uses existing German accessibility labels, bounded condition waits,
and scrolling to visible controls; it never signs in or submits learner data.
The welcome controls have entrance animations, so the flow also waits briefly
for UI stability before tapping Login; the navigation assertion still must pass.

These device tests are opt-in and are not part of `pnpm test`. They need a native
artifact and a running virtual device. Jest and Vitest do not require Maestro.

### Setup

1. Install Java 17+ and [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).
   The reference CLI version is **2.10.0**. On Windows, use the official release
   ZIP and put its `maestro/bin` directory on PATH; WSL is not required.
   Check `maestro --version` before running.
2. Start a **disposable Android emulator or iOS simulator** in portrait at default
   text/display size. iOS requires macOS and Xcode. Use `adb devices -l` or
   `xcrun simctl list devices booted` to get its ID, and pass that ID explicitly.
   For Android development-client runs, use at least 4 GB emulator RAM with enough
   host memory available. A 2 GB Google Play emulator exhausted memory during
   local validation; check device memory pressure before changing flow timeouts.
   Do not target a personal device or a simulator containing accounts you need:
   each run clears the app's local storage and **the entire iOS Keychain**.
   Development and preview builds share an app ID, so installing one replaces
   the other on that virtual device.
3. Install a **preview build with an embedded JavaScript bundle** from the source
   revision you intend to test. Use `APP_VARIANT=preview`, a Clerk test instance,
   and a non-production Convex deployment. The app ID alone does not prove the
   backend environment is non-production. Supply the release-required public
   configuration from [`.env.example`](../.env.example) at build time; no Clerk
   secret key, learner account, or AI credentials are needed by this flow.
   Leave PostHog disabled unless using an isolated test project.

   Android requires an APK (not an AAB):

   ```sh
   adb -s emulator-5554 install -r /path/to/dayova-preview.apk
   ```

   iOS requires a simulator `.app` (not a device IPA):

   ```sh
   xcrun simctl install <simulator-udid> /path/to/Dayova.app
   ```

   The existing EAS `preview` profile uses the preview environment, but its iOS
   artifact is for physical devices. The `development-simulator` profile uses
   the production environment and a dev client, so it is **not** this smoke-test
   artifact. The native build/automation follow-ups below own suitable EAS
   artifacts. To build locally with your non-production public configuration:

   ```sh
   pnpm exec cross-env APP_VARIANT=preview expo run:android --variant release --device emulator-5554
   pnpm exec cross-env APP_VARIANT=preview expo run:ios --configuration Release --device <simulator-udid>
   ```

   An embedded preview bundle is the reference path. Ensure the artifact's
   update channel cannot replace the intended revision with an unrelated OTA.

### Local iOS artifact and provenance

Create a fresh simulator, rather than resetting an existing personal simulator.
For example, with the iOS 26.5 runtime installed:

```sh
xcrun simctl create DAY-314-disposable com.apple.CoreSimulator.SimDeviceType.iPhone-17 com.apple.CoreSimulator.SimRuntime.iOS-26-5
xcrun simctl boot <returned-udid>
xcrun simctl bootstatus <returned-udid> -b
```

Explicitly export the public configuration before **both** native generation and
bundling. Set `EXPO_NO_DOTENV=1` to prevent another `.env.local` from supplying
production settings or enabling analytics, `APP_VARIANT=preview`, and
`EAS_BUILD_PLATFORM=ios` for platform-specific release validation. Check the
actual Convex deployment type and its Clerk issuer; a deployment name, EAS
environment label, or `pk_test_` key alone does not establish both services'
isolation. The preview environment must also contain the required RevenueCat
public iOS store key and legal URLs. This journey never initializes purchases.

For a local artifact that must use the embedded revision, generate iOS in a clean
checkout, disable updates in the **generated, ignored** native project, and build
without running prebuild again:

```sh
pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
/usr/libexec/PlistBuddy -c 'Set :EXUpdatesEnabled false' ios/Dayova/Supporting/Expo.plist
NODE_ENV=production xcodebuild -workspace ios/Dayova.xcworkspace -scheme Dayova \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .maestro/artifacts/ios-build -jobs 2 \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
xcrun simctl install <simulator-udid> .maestro/artifacts/ios-build/Build/Products/Release-iphonesimulator/Dayova.app
```

The architecture above is for Apple Silicon. Record the source SHA, environment
sources, build command, `.app` executable and `main.jsbundle` hashes. Inspect the
artifact's `Info.plist` for `de.dayova.app-dev` and `iPhoneSimulator`, its
`Expo.plist` for disabled updates, and the embedded bundle for the intended
public backend configuration. Run the reference flow without Metro or
`DEV_SERVER_URL`. This local OTA-disabled artifact verifies embedded startup;
it does not validate EAS preview-channel delivery. Shut down the owned simulator
and stop any Metro/build/keep-awake processes when finished.
Keep the Mac's lid open during validation; `caffeinate` prevents idle sleep but
does not prevent clamshell sleep, which can time out the XCUITest driver.

Keep Xcode's simulator signing enabled with the ad hoc identity `-`. An unsigned
build can install and launch while Clerk/SecureStore Keychain operations fail
with `OSStatus -34018`. Xcode generates the simulator's `application-identifier`
in `Dayova.app-Simulated.xcent` and embeds it in the executable's
`__TEXT,__entitlements` section. The ordinary `codesign --display --entitlements`
output can be empty for a correctly signed simulator app; inspect the simulated
entitlements as well. This local simulator signing uses no distribution
certificate or provisioning profile. See Apple's
[Keychain entitlement documentation](https://developer.apple.com/documentation/security/errsecmissingentitlement).

### Run

From the repository root, with Maestro on PATH:

```sh
pnpm test:smoke:android --device emulator-5554
pnpm test:smoke:ios --device <simulator-udid>
```

For local iteration, the same flow also supports a compatible development build
and Metro serving this checkout with non-production public configuration.

For iOS, the local Xcode recipe above can produce that development client by
using `APP_VARIANT=development`, `NODE_ENV=development`, and
`-configuration Debug`, then installing `Debug-iphonesimulator/Dayova.app`.
Keep the same explicit test backend configuration when starting Metro.

```sh
pnpm expo:start --dev-client --port 8081
adb -s emulator-5554 reverse tcp:8081 tcp:8081
pnpm test:smoke:android --device emulator-5554 -e DEV_SERVER_URL=http://127.0.0.1:8081
```

On an iOS simulator on the same Mac, omit `adb reverse` and pass the same
`-e DEV_SERVER_URL=http://127.0.0.1:8081` to `test:smoke:ios`. Start Metro before
running; select the port of this checkout, not another working tree. The flow
waits for the development launcher, then opens Expo's development-client URL
after resetting state, with
[`disableOnboarding=1`](https://docs.expo.dev/develop/development-builds/development-workflows/)
on both the encoded server URL (read by iOS SDK 57) and the outer link
(for Android compatibility) to skip the dev client's onboarding.
If SDK 57 still opens its developer menu,
the flow closes it using its accessible Close control. All app assertions remain
the same. Do not pass `DEV_SERVER_URL` for an embedded preview build. Expo Go is not
supported by this app. Dev-client runs verify the installed native runtime plus
the current Metro bundle; they do not prove an embedded release bundle launches.

On iOS, the first custom-scheme launch can show an **Open in Dayova?** system
confirmation. The helper conditionally accepts that specific prompt before
waiting for the app/developer menu. It was validated with the simulator's English
system language; Dayova's app assertions use German accessibility labels.
The OS can retain this confirmation across app-state resets. See Maestro's
[iOS deep-link behavior](https://docs.maestro.dev/api-reference/commands/openlink).
If an older flow stopped at this dialog, dismiss its pending prompt before
rerunning; resetting the app does not dismiss that existing system dialog.
Record whether Metro's bundle cache was already warm when collecting evidence;
starting the server alone does not precompile the app's JavaScript.

On Windows, Maestro 2.10.0 can stall while starting/reinstalling its Android
driver before any flow commands run. If the same CLI version's driver is already
installed, retry the command with `--no-reinstall-driver` to reuse it. This does
not skip app reset or assertions. Do not use that option to bootstrap a fresh
device or after changing CLI versions; inspect the driver logs first. This
limitation is tracked in [DAY-382](https://linear.app/dayova/issue/DAY-382).

Both commands discover the same flow through `.maestro/config.yaml`. They supply
the non-production IDs from `app.config.cts`: `com.dayova.dev` on Android and
`de.dayova.app-dev` on iOS. The flow rejects other IDs before clearing state.
Run twice to check that the reset also works after the previous run ends on Login.
App initialization still needs network access to the configured Clerk instance;
this is a native launch/navigation check, not an offline or authenticated backend
integration test. Runtime permissions are denied because this journey needs none.

A missing app, launch failure, or absent expected control must produce a nonzero
exit status. Startup waits are each bounded at 60 seconds, including the cold
native development launcher and local Metro bundle. Later navigation waits are
shorter. Increasing a bound should follow investigation of the failure, not
replace it. The flow uses real
navigation from the entry screen instead of deep-linking past the launch route.

Find the JUnit report at `.maestro/artifacts/<platform>/report.xml`, successful
welcome/login screenshots and other artifacts under that platform directory,
and debugging output under its `debug/` subdirectory. These files are ignored by
Git. Copy evidence you need to retain before rerunning the same platform command;
the report/output path is reused. Inspect the failed command and screenshot to
distinguish app configuration, auth bootstrap, launcher, and selector failures.

### Follow-up coverage

- [DAY-311](https://linear.app/dayova/issue/DAY-311) and
  [DAY-312](https://linear.app/dayova/issue/DAY-312): native Android/iOS build checks.
- [DAY-315](https://linear.app/dayova/issue/DAY-315) and
  [DAY-316](https://linear.app/dayova/issue/DAY-316): run this shared smoke flow in
  EAS on Android/iOS and retain failure artifacts.
- [DAY-321](https://linear.app/dayova/issue/DAY-321): dedicated test identity,
  real Clerk sign-in, and an authenticated Convex operation.
- [DAY-194](https://linear.app/dayova/issue/DAY-194): broader viewport, text-size,
  and interaction regression coverage.
