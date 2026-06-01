# Package Patches

This directory contains patches applied by `pnpm` through the
`patchedDependencies` section in `pnpm-workspace.yaml`.

When a patched package is installed, pnpm applies the matching `.patch` file to
the package contents in `node_modules`. Keep each patch documented here so future
dependency updates can decide whether the patch is still needed.

## `nativewind@4.2.3.patch`

### Why This Patch Exists

NativeWind 4.2.3 starts a child Tailwind CLI process from Metro through
`dist/metro/tailwind/v3/index.js` and `dist/metro/tailwind/v3/child.js`.
Development builds need this process to stay alive when Metro supplies an
`onChange` callback, because it watches Tailwind input and sends regenerated CSS
back to Metro.

Release builds are different. During iOS EAS Build, `expo-updates` runs this
script while generating embedded update resources:

```text
node node_modules/expo-updates/utils/build/createUpdatesResources.js ios ...
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

The patch is activated for non-Debug native builds by `metro.config.js`:

```js
if (process.env.CONFIGURATION && !process.env.CONFIGURATION.includes("Debug")) {
  process.env.NATIVEWIND_DISABLE_WATCH ??= "true";
}
```

Debug builds and Metro development sessions keep watch behavior, because they
either do not set `CONFIGURATION` or set it to a value containing `Debug`.

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
$env:CONFIGURATION = 'Release'
node node_modules/expo-updates/utils/build/createUpdatesResources.js ios (Get-Location).Path $dest all index.ts
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
   `CONFIGURATION=Release`.
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
