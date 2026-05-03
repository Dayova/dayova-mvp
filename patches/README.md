# Dependency Patches

This directory contains pnpm-native dependency patches registered in
`pnpm-workspace.yaml` under `patchedDependencies`.

Do not use `patch-package` for these patches. This project uses pnpm, and pnpm
applies these patch files during `pnpm install` without a `postinstall` hook.

## `expo-keep-awake@15.0.8.patch`

### Summary

This patch prevents an Expo development-time keep-awake failure from becoming an
unhandled promise rejection surfaced by the React Native / Expo error overlay.

This was observed as a runtime error during development. The evidence does not
show a native process crash. The concern is that an optional keep-awake failure
is shown as an app-level error and can interrupt development or manual testing.

The patch changes `expo-keep-awake/src/index.ts` inside `useKeepAwake` from:

```ts
activateKeepAwakeAsync(tagOrDefault).then(() => {
  // ...
});
```

to:

```ts
activateKeepAwakeAsync(tagOrDefault)
  .then(() => {
    // ...
  })
  .catch((error) => {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "[expo-keep-awake] Unable to activate keep awake. This optional development feature failed, so the device may sleep normally.",
        error,
      );
    }
  });
```

This means: if native keep-awake activation fails, the hook no longer lets that
failure escape as an unhandled promise rejection. The device may still sleep
normally; the app should continue.

In development builds, the failure is still logged with `console.warn` so a
developer can see that the optional keep-awake feature failed. The warning is
not intended as an end-user notification and should not be shown in production.

### Original Symptom

The app reported this development runtime error:

```text
ERROR [Error: Uncaught (in promise, id: 0) Error: Unable to activate keep awake]
```

The stack pointed into Expo module error construction:

```text
expo-modules-core/src/errors/CodedError.ts
```

There was no evidence that the app process terminated, and there was no
app-level use of `expo-keep-awake`, `useKeepAwake`,
`activateKeepAwake`, or `activateKeepAwakeAsync`.

### Root Cause

Expo's dev launcher/dev tools wrapper imports `expo-keep-awake` when it is
available. In Expo SDK 54, this comes from Expo's own dev wrapper, roughly:

```ts
const { useKeepAwake, ExpoKeepAwakeTag } = require("expo-keep-awake");
return () => useKeepAwake(ExpoKeepAwakeTag, {
  suppressDeactivateWarnings: true,
});
```

That hook calls `activateKeepAwakeAsync(tagOrDefault).then(...)` but does not
attach a rejection handler. If the native module rejects with `"Unable to
activate keep awake"`, JavaScript sees an unhandled promise rejection. In
development, Expo/React Native can surface that as a redbox/error overlay.

The important point: this is not business logic and not part of the calendar
feature. It is development/runtime infrastructure trying to keep the screen
awake while the app is running.

### Why We Patch It

The app should not show an app-level runtime error because an optional screen
wake-lock could not be activated.

Keep-awake is a convenience feature. If activation fails, the worst acceptable
outcome is that the device is allowed to sleep normally. It should not be
presented as a product/runtime failure during app startup, navigation, or UI
interactions.

The patch preserves the successful path exactly:

- If `activateKeepAwakeAsync` succeeds, listener registration still runs.
- If the component unmounts, deactivation logic remains unchanged.
- If activation fails, the unhandled rejection is suppressed.
- In development, failed activation is still reported with `console.warn`.

### Why This Patch Is Safe

This patch does not change application data, navigation, Convex queries,
authentication, or rendering logic.

The behavioral tradeoff is narrow:

- Before the patch: failed keep-awake activation can surface as an unhandled
  promise rejection / Expo error overlay.
- After the patch: failed keep-awake activation is handled by the hook and logged
  as a development-only warning.

Handling activation failure is acceptable because keep-awake is optional. The
screen may sleep according to OS settings, but the optional keep-awake failure
is not promoted to an app-level error.

### Known Limitations

This patch does not make the native keep-awake module succeed.

If the underlying platform, emulator, dev client, or native module state cannot
activate keep-awake, that condition can still exist. The patch only prevents
that optional failure from becoming an unhandled promise rejection surfaced as
an app-level development runtime error.

The patch intentionally logs only in development. Do not throw from the catch
handler, and do not add user-facing UI for this failure unless keep-awake becomes
a product requirement.

### Why pnpm Native Patches Are Used

The project uses pnpm and has `pnpm-lock.yaml`. `patch-package` expects npm or
yarn lockfiles and produced this error when attempted:

```text
No package-lock.json, npm-shrinkwrap.json, or yarn.lock file.
```

Therefore this patch is managed by pnpm's built-in patch system:

```yaml
patchedDependencies:
  expo-keep-awake@15.0.8: patches/expo-keep-awake@15.0.8.patch
```

This is why `package.json` should not contain a `postinstall` script for
`patch-package`, and `patch-package` should not be installed just for this.

### How To Verify The Patch Is Applied

After `pnpm install`, verify pnpm resolves `expo-keep-awake` to a patched package
and that the patched source includes the development warning:

```sh
node -e "const p=require.resolve('expo-keep-awake/package.json',{paths:[require.resolve('expo/package.json')]}); const fs=require('fs'); const path=require('path'); const src=fs.readFileSync(path.join(path.dirname(p),'src/index.ts'),'utf8'); console.log(p); console.log(src.includes('[expo-keep-awake] Unable to activate keep awake'));"
```

Expected output:

```text
...expo-keep-awake...
true
```

Also run:

```sh
pnpm typecheck
```

### When This Patch Can Be Removed

Remove this patch only when all of these are true:

1. The installed `expo-keep-awake` version no longer has an unhandled
   `activateKeepAwakeAsync(...).then(...)` path in `useKeepAwake`.
2. Expo's dev wrapper either no longer calls `useKeepAwake`, handles activation
   failure itself, or depends on a fixed `expo-keep-awake` implementation.
3. The app has been run in the environment that originally reproduced the error
   and no longer logs:

```text
Unable to activate keep awake
Uncaught (in promise)
```

4. `pnpm install` succeeds without needing this `patchedDependencies` entry.

### How To Remove It

1. Upgrade Expo / `expo-keep-awake` to the candidate fixed version.
2. Inspect the installed package:

```sh
node -e "const p=require.resolve('expo-keep-awake/package.json',{paths:[require.resolve('expo/package.json')]}); console.log(p)"
```

3. Confirm `useKeepAwake` handles rejected activation promises or no longer uses
   the problematic promise chain.
4. Delete this line from `pnpm-workspace.yaml`:

```yaml
patchedDependencies:
  expo-keep-awake@15.0.8: patches/expo-keep-awake@15.0.8.patch
```

If there are no remaining patched dependencies, remove the entire
`patchedDependencies` block.

5. Delete `patches/expo-keep-awake@15.0.8.patch`.
6. Run:

```sh
pnpm install
pnpm typecheck
```

7. Restart Metro with a cleared cache:

```sh
pnpm expo:start --clear
```

8. Re-test the app in the environment that originally reproduced the issue.

### When Not To Remove It

Do not remove this patch just because:

- The error is not currently visible on one device.
- A clean Metro cache temporarily hides the issue.
- A native rebuild changes timing.
- The app itself does not import `expo-keep-awake`.

The original call path was through Expo's dev/runtime wrapper, not app code.
Removal should be based on the dependency implementation being fixed or no
longer used.

### Recreating Or Updating The Patch

Use pnpm's patch workflow:

```sh
pnpm patch expo-keep-awake@15.0.8
```

Edit the temporary package directory printed by pnpm, then commit it:

```sh
pnpm patch-commit "<path printed by pnpm patch>"
```

Do not manually edit files inside `node_modules/.pnpm/...` as the permanent
fix. Direct `node_modules` edits are overwritten by install operations.
