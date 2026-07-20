# Package Patches

This directory contains patches applied by `pnpm` through the
`patchedDependencies` section in `pnpm-workspace.yaml`.

When a patched package is installed, pnpm applies the matching `.patch` file to
the package contents in `node_modules`. Keep each patch documented here so future
dependency updates can decide whether the patch is still needed.

## `@expo/metro-config@57.0.6.patch`

### Why This Patch Exists

Expo SDK 57's binary Metro cache starts one asynchronous `readFile` for every
transform requested by Metro. A cold Dayova Android development bundle contains
roughly 8,000 modules. On Windows with Node 24.18.0, the next bundle request can
therefore exceed Node's file-descriptor table and fail with:

```text
EMFILE: too many open files, open
'C:\Users\...\AppData\Local\Temp\metro-cache\...\.mp'
```

The failure was reproduced independently of Expo Router and the app by calling
the real `BinaryFileStore.get()` for all 9,565 cache entries. The unpatched store
failed with `EMFILE`; the patched store completed the same test.

This binary store was introduced upstream in
[`expo/expo#45656`](https://github.com/expo/expo/pull/45656) and received
concurrent read/write handling in
[`expo/expo#46171`](https://github.com/expo/expo/pull/46171), but that handling
does not bound simultaneous reads. After the Expo SDK 57 integration,
`@expo/metro-config@57.0.6` was tested without the patch: the deterministic
regression test observed all 1,024 requested reads active concurrently. The
upgrade therefore does not remove the failure.

### What The Patch Changes

The patch adds a process-wide FIFO slot queue around binary cache reads and
allows at most 256 simultaneous `fs.promises.readFile` calls. A completed read
transfers its slot directly to the next waiter, so new requests cannot jump the
queue. Other Metro file operations retain ample descriptor headroom while cache
reads remain highly concurrent.

Only the published `build/binary-file-store.js` file is patched because the npm
package does not ship the TypeScript source.

### How To Verify

Run the deterministic regression test:

```sh
pnpm test:unit:metro-cache
```

It replaces `readFile` with a controlled asynchronous cache miss, sends 1,024
requests through the installed Expo `FileStore`, and asserts that no more than
256 reads are active concurrently.

For the full Windows integration path, clear Metro's cache, load Dayova on the
connected Android development client, and then reload it:

```powershell
pnpm exec expo start --dev-client --clear
```

Both the initial bundle and reload must complete without `EMFILE`.

### How To Update Or Remove

When upgrading Expo or `@expo/metro-config`:

1. Inspect upstream `packages/@expo/metro-config/src/binary-file-store.ts` for a
   read-concurrency limit, retry queue, or equivalent `EMFILE` handling.
2. Remove the `patchedDependencies` entry temporarily, then run
   `pnpm install --force` so `node_modules` contains the unpatched package rather
   than pnpm's previously patched installation.
3. Run `pnpm test:unit:metro-cache`; it must still pass against that unpatched
   package, then run the cold-cache Android integration path above on Windows.
4. If both checks pass, delete `patches/@expo__metro-config@57.0.6.patch`.
5. Run `pnpm install`, `pnpm check`, and `pnpm test`.
## `@react-native__gradle-plugin@0.86.0.patch`

### Why This Patch Exists

Expo SDK 57 upgrades React Native from 0.85 to 0.86. The React Native 0.86
Gradle plugin applies `org.gradle.toolchains.foojay-resolver-convention` from
its Kotlin `settings.gradle.kts` so Gradle can provision a matching JDK.

On Dayova's Windows environment, Gradle 9.3.1 miscompiled that settings script
before plugin resolution and reported `Unresolved reference 'plugins'` and
`Unresolved reference 'id'`. The failure reproduced when the React Native
Gradle plugin was built by itself, before Dayova's Android project or native
modules were configured. The upstream report
[gradle/gradle#36323](https://github.com/gradle/gradle/issues/36323) records the
same Windows failure shape on Gradle 9.2.1 and 9.3.0; Dayova independently
reproduced it on 9.3.1.

Dayova already requires JDK 17 for Android development and EAS Android build
images provide the required JDK, so automatic Foojay toolchain provisioning is
not needed for this project.

### What The Patch Changes

The patch removes only the Foojay settings plugin block from
`@react-native/gradle-plugin/settings.gradle.kts`. It does not change React
Native's application Gradle plugin, settings plugin, autolinking, codegen, or
native compilation behavior.

Developers must keep a compatible JDK configured through `JAVA_HOME`; for SDK
57 Android development in this repo, use JDK 17.

### How To Verify

After installing dependencies, run a clean Android build on Windows:

```powershell
pnpm install
cd android
.\gradlew.bat clean :app:assembleDebug
```

Expected result: Gradle configures `com.facebook.react.settings`, Expo
autolinking, and the app's native modules without failing in React Native's
`settings.gradle.kts`.

If the patched file is present but Gradle instead fails while resolving
`com.facebook.react.settings` with a `NoSuchMethodError` for
`Settings_gradle.<init>`, first verify the failure with `gradlew.bat help`. This
is a separate stale Kotlin-DSL cache failure, not evidence that the patch was
not applied. It occurred during the SDK 57 integration when Gradle reused a
compiled settings-script class with the old one-argument `Settings` constructor
for a script that now required the three-argument `KotlinScriptHost`,
`PluginDependenciesSpec`, and `Settings` constructor.

Stop Gradle and move `%USERPROFILE%\.gradle\caches` aside before retrying. Keep
the moved directory until `gradlew.bat help` and the clean native build both
pass, then archive or remove it when disk space is needed. Moving only the
`kotlin-dsl`, `build-cache`, or `jars` subdirectory did not repair the observed
cache state; rebuilding the complete Gradle cache did.

Then run the normal project checks:

```sh
pnpm check
pnpm test
npx expo-doctor
```

### How To Update Or Remove

Recheck the patch whenever Expo changes the React Native 0.86 patch version or
upgrades React Native. Remove it when the upstream Gradle/React Native
combination configures successfully on Windows without the patch.

Removal checklist:

1. Delete `patches/@react-native__gradle-plugin@0.86.0.patch`.
2. Remove its entry from `patchedDependencies` in `pnpm-workspace.yaml`.
3. Run `pnpm install`.
4. Run the clean Android build and normal checks above on Windows.

If the workaround is still required for a new React Native Gradle plugin
version, regenerate it with:

```sh
pnpm patch @react-native/gradle-plugin@<version>
# Remove only the Foojay `plugins` block from settings.gradle.kts.
pnpm patch-commit "<temporary patch directory printed by pnpm>"
```

## `react-native-keyboard-controller@1.21.9.patch`

### Why This Patch Exists

Expo SDK 57's recommended `react-native-keyboard-controller` version supports
React Native 0.86, but opening a React Native `Modal` on Android logs an
unhandled Fabric soft exception:

```text
Fabric View [-1] does not have SurfaceId associated with it
```

`ModalAttachedWatcher` installs a keyboard callback on the Android dialog's
decor view. `FocusedInputObserver` then asks React Native for the surface ID of
that native decor view, which is not part of a Fabric surface. The warning was
reproduced on a Pixel 9 running Android 16 whenever Dayova opened its create
type bottom modal. The modal remained visible, but the observer initialized
with an invalid surface ID.

### What The Patch Changes

`KeyboardAnimationCallback` now accepts an explicit surface ID and passes it to
`FocusedInputObserver`. The normal non-modal path keeps the package's existing
surface lookup. For a modal, `ModalAttachedWatcher` supplies the surface ID from
the Fabric `topShow` event that caused the callback to be installed, rather than
trying to infer a surface from the dialog's native window hierarchy.

The patch changes only Android surface-ID plumbing. It does not alter keyboard
animation, focused-input tracking, modal layout, or iOS behavior.

### How To Verify

Build and install the Android debug app, clear Logcat, and open a Dayova bottom
modal such as the create-type picker:

```powershell
cd android
.\gradlew.bat :app:assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb logcat -c
# Open the modal on the device.
adb logcat -d | Select-String 'UIManagerHelper|Fabric View'
```

Expected result: the modal opens normally and Logcat contains no
`UIManagerHelper` surface-ID soft exception. Also focus an input and confirm
that keyboard avoidance still works.

### How To Update Or Remove

Recheck this patch whenever `react-native-keyboard-controller` is upgraded.
Remove it when the package resolves modal keyboard events against a
React-managed surface, or otherwise avoids querying a surface ID from the
dialog decor view.

Removal checklist:

1. Delete `patches/react-native-keyboard-controller@1.21.9.patch`.
2. Remove its entry from `patchedDependencies` in `pnpm-workspace.yaml`.
3. Run `pnpm install`.
4. Rebuild Android and repeat the modal Logcat verification above.

If the workaround is still required for a new package version, regenerate it
with:

```sh
pnpm patch react-native-keyboard-controller@<version>
# Pass the modal show event's surface ID into the callback and observer.
pnpm patch-commit "<temporary patch directory printed by pnpm>"
```
## `nativewind@4.2.3.patch`

### Why This Patch Exists

NativeWind 4.2.3 starts a child Tailwind CLI process from Metro through
`dist/metro/tailwind/v3/index.js` and `dist/metro/tailwind/v3/child.js`.
Development builds need this process to stay alive when Metro supplies an
`onChange` callback, because it watches Tailwind input and sends regenerated CSS
back to Metro.

Release builds are different. During native EAS Build, `expo-updates` runs this
script while generating embedded update resources:

```text
node node_modules/expo-updates/utils/build/createUpdatesResources.js <platform> ...
```

That script asks Metro to bundle the app and write update resources such as
`app.manifest`. In this project, the bundling work completed, but the build hung
for more than an hour at:

```text
› Executing expo-updates Pods/EXUpdates » [CP-User] Generate updates resources for expo-updates
```

The local reproduction showed `app.manifest` was already written while a
NativeWind Tailwind child process remained alive. That kept the parent resource
generation command open, so EAS never moved past the `expo-updates` build phase.

NativeWind 4.2.4 was checked before keeping this patch. Its release only updates
README/repository metadata and bumps `react-native-css-interop` to 0.2.4. There
are no changes under `packages/nativewind/src/metro/tailwind/v3`, and the
published 4.2.4 tarball keeps the same child-process lifecycle. NativeWind
5.0.0-preview.4 uses a different Tailwind v4/react-native-css stack and is not a
drop-in production release.

### What The Patch Changes

The patch updates NativeWind's Tailwind v3 Metro integration in both `src` and
`dist` files shipped by the package.

In `index.js` / `index.ts`, it:

- Reads `process.env.NATIVEWIND_DISABLE_WATCH`.
- Forces `NATIVEWIND_WATCH=false` when that flag is `"true"`.
- Kills the child process after the first CSS message when Metro did not provide
  an `onChange` callback.
- Resolves with an empty string if the child exits before sending CSS in
  non-watch mode.

In `child.js` / `child.ts`, it:

- Computes `isWatchMode` once from `NATIVEWIND_WATCH`.
- Exits immediately after sending the first CSS payload in non-watch mode.
- Exits after `await build(args)` in non-watch mode if Tailwind completes
  without going through the patched `writeFile` path.
- Adds a 30-second non-watch timeout as a final guard against another indefinite
  Tailwind child process.

The patch is activated for release-like native bundles by `metro.config.js`:

```js
const nativeBuildConfiguration = process.env.CONFIGURATION;
const isDebugNativeBuild = nativeBuildConfiguration?.includes("Debug") ?? false;
const isReleaseLikeBundle =
  (nativeBuildConfiguration && !isDebugNativeBuild) ||
  process.env.EAS_BUILD === "true" ||
  process.env.NODE_ENV === "production";

if (isReleaseLikeBundle) {
  process.env.NATIVEWIND_DISABLE_WATCH ??= "true";
}
```

Debug builds and Metro development sessions keep watch behavior, because they
do not set `NODE_ENV=production`/`EAS_BUILD=true`, or set `CONFIGURATION` to a
value containing `Debug`.

### Why This Approach

The failure happens inside the package code that owns the child process. Setting
`NATIVEWIND_DISABLE_WATCH` in `metro.config.js` gives the app an explicit release
build switch, while the package patch keeps the lifecycle fix close to the code
that forks and controls the Tailwind process.

This avoids broad release-workflow changes and does not disable NativeWind. It
only changes the package from watcher mode to one-shot mode when release builds
do not need live CSS regeneration.

### How To Verify

Run the same resource-generation path that EAS hits:

```powershell
$dest = Join-Path $env:TEMP ('dayova-updates-resources-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$env:EAS_BUILD = 'true'
Remove-Item Env:\CONFIGURATION -ErrorAction SilentlyContinue
node node_modules/expo-updates/utils/build/createUpdatesResources.js android (Get-Location).Path $dest all index.ts
```

Expected result: the command exits normally, writes `app.manifest` under `$dest`,
and does not leave a NativeWind/Tailwind child `node` process running.

Then run the normal project checks:

```sh
pnpm check
pnpm test
npx expo-doctor
```

For a remote confirmation, start an iOS production EAS Build and confirm it moves
past:

```text
› Executing expo-updates Pods/EXUpdates » [CP-User] Generate updates resources for expo-updates
```

The first fixed build was build number 41, EAS build
`e1e130e2-ba12-4a96-ac7f-ac651191c0af`, from commit `e33e7de`.

### How To Update Or Remove

When upgrading NativeWind, check the new package before removing this patch:

1. Inspect the upstream diff for `packages/nativewind/src/metro/tailwind/v3`.
2. Inspect the published npm tarball for
   `dist/metro/tailwind/v3/index.js` and `dist/metro/tailwind/v3/child.js`.
3. Confirm the child process exits in non-watch mode after initial CSS
   generation.
4. Run the `createUpdatesResources.js` reproduction above with
   `EAS_BUILD=true` and no `CONFIGURATION`.
5. Run `pnpm check`, `pnpm test`, and `npx expo-doctor`.

Useful commands:

```sh
git clone https://github.com/nativewind/nativewind.git ~/.btca/agent/sandbox/nativewind
git -C ~/.btca/agent/sandbox/nativewind fetch --tags origin
git -C ~/.btca/agent/sandbox/nativewind diff nativewind@4.2.3 nativewind@<new-version> -- packages/nativewind/src/metro/tailwind/v3
npm pack nativewind@<new-version>
```

The patch can be removed when a stable NativeWind release provides equivalent
non-watch child-process shutdown behavior, or when this app migrates to a newer
NativeWind major version and the old Tailwind v3 Metro child process is no
longer used.

Removal checklist:

1. Delete `patches/nativewind@4.2.3.patch`.
2. Remove the `nativewind@4.2.3` entry from `patchedDependencies` in
   `pnpm-workspace.yaml`.
3. Remove the `NATIVEWIND_DISABLE_WATCH` block from `metro.config.js` unless the
   new NativeWind version documents the same flag.
4. Run `pnpm install` to update `pnpm-lock.yaml`.
5. Run the resource-generation reproduction and normal checks listed above.

If the patch must be regenerated for a new NativeWind 4.x version, use:

```sh
pnpm patch nativewind@<version>
# edit src/metro/tailwind/v3/index.ts, src/metro/tailwind/v3/child.ts,
# dist/metro/tailwind/v3/index.js, and dist/metro/tailwind/v3/child.js
pnpm patch-commit "<temporary patch directory printed by pnpm>"
```

## `oxc-parser@0.130.0.patch`

### Why This Patch Exists

`pnpm check:unused` runs Knip, and Knip 6.13.1 uses `oxc-parser` to parse
JavaScript and TypeScript files. On Node.js 24.14.1, `oxc-parser@0.130.0`
reports that its experimental raw-transfer parser is supported, so Knip enables
it.

The raw-transfer path allocates a transfer buffer with this size:

```text
BLOCK_SIZE + BLOCK_ALIGN
= 2,147,483,632 + 4,294,967,296
= 6,442,450,928 bytes
```

That is roughly 6 GiB of virtual address space per parse operation. On this
Windows development environment, the support check returns `true`, but the real
allocation fails immediately:

```text
RangeError: Array buffer allocation failed
    at new ArrayBuffer
    at createBuffer (.../oxc-parser/src-js/raw-transfer/common.js:276:23)
```

The first observed crash happened while Knip was parsing `babel.config.js`, so
Knip failed before it could report unused files, exports, or dependencies.

### What The Patch Changes

The patch updates `src-js/raw-transfer/supported.js` inside `oxc-parser`.

Before the patch, `rawTransferSupported()` returned `true` when:

- the runtime looked compatible, and
- the native binding reported raw-transfer support.

After the patch, it also performs a real allocation probe for
`BLOCK_SIZE + BLOCK_ALIGN`. If that allocation throws, raw transfer is treated as
unsupported and callers fall back to the normal `oxc-parser` parser path.

The patch does not change parsing semantics. It only prevents selecting an
experimental fast path that cannot actually allocate its required buffer in this
environment.

### Why This Approach

This keeps Knip's normal plugin coverage intact. Disabling Knip plugins such as
Babel would avoid the first crash site, but it would also reduce unused-code
coverage and would not address later source-file parsing that could hit the same
raw-transfer path.

The allocation probe is intentionally local to `oxc-parser`'s existing support
check. That means any consumer of `rawTransferSupported()` gets the safer answer,
while consumers that do not opt into raw transfer are unaffected.

### How To Verify

Run:

```sh
pnpm check:unused
```

Expected result: Knip completes normally. If there are unused-code findings, Knip
may still exit non-zero for those findings, but it should not crash with
`RangeError: Array buffer allocation failed`.

To specifically confirm the patch is active after reinstalling dependencies:

```sh
pnpm install
pnpm check:unused
```

### How To Update Or Remove

When upgrading Knip or `oxc-parser`, check whether upstream has fixed the
raw-transfer support detection. The patch can be removed when one of these is
true:

- `oxc-parser` no longer reports raw transfer as supported unless the required
  transfer buffer can actually be allocated.
- Knip stops enabling `experimentalRawTransfer` based only on
  `rawTransferSupported()`.
- The project pins a Node/runtime combination where `pnpm check:unused` passes
  without this patch.

Removal checklist:

1. Delete `patches/oxc-parser@0.130.0.patch`.
2. Remove the `oxc-parser@0.130.0` entry from `patchedDependencies` in
   `pnpm-workspace.yaml`.
3. Run `pnpm install` to update `pnpm-lock.yaml`.
4. Run `pnpm check:unused` to confirm Knip still completes normally.

If the patch must be regenerated for a new `oxc-parser` version, use:

```sh
pnpm patch oxc-parser@<version>
# edit src-js/raw-transfer/supported.js in the temporary patch directory
pnpm patch-commit "<temporary patch directory printed by pnpm>"
pnpm check:unused
```
