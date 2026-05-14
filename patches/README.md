# Package Patches

This directory contains patches applied by `pnpm` through the
`patchedDependencies` section in `pnpm-workspace.yaml`.

When a patched package is installed, pnpm applies the matching `.patch` file to
the package contents in `node_modules`. Keep each patch documented here so future
dependency updates can decide whether the patch is still needed.

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
