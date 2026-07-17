# Expo Skill Maintenance

The Expo skills in `.agents/skills` are composed artifacts: the latest upstream
`expo/skills` catalog plus Dayova's compatibility patch and checked replacement.
Agents load only the final composed skill, so there is no competing runtime
overlay.

## Sources of truth

- `skills-lock.json` records upstream Expo paths and hashes. Keep these hashes
  equal to upstream; do not rewrite them to disguise local corrections.
- `patches/expo-skills/dayova.patch` contains the Dayova delta.
- `patches/expo-skills/overrides.json` records checksum-guarded replacements.
  The native-controls source lives under `patches/expo-skills/files/` because
  incompatible upstream examples must not enter model context.
- `docs/contexts/design-system/CONTEXT.md` owns the underlying Dayova control
  and styling decisions.

## Supported refresh

Use the repository command instead of running `npx skills update` directly:

```sh
pnpm skills:update:expo
```

The updater performs the following work before touching the repository:

1. Fetches every current Expo skill into an isolated temporary Git repository,
   targeting Codex only.
2. Removes unsupported `version` frontmatter mechanically.
3. Checks and applies the Dayova patch. An overlapping upstream change stops
   the update instead of silently discarding or blending guidance.
4. Verifies the upstream checksum for each complete-file replacement, then
   copies its local source into the staged catalog. Any upstream change to a
   replaced file stops for reconciliation instead of being ignored.
5. Validates every composed skill and its local links.
6. Refuses to overwrite uncommitted changes in managed Expo paths.
7. Replaces only Expo-managed skill folders, merges only Expo lock entries, and
   runs typechecking plus the full test suite. A failed verification restores
   the previous catalog.

To check whether the repository matches the latest composed catalog without
writing files, run:

```sh
pnpm skills:update:expo -- --check
```

## Resolving patch conflicts

When an upstream edit overlaps `dayova.patch`, inspect the new upstream text
before changing the patch:

- Remove a hunk when upstream now expresses the same rule correctly.
- Rebase a still-required Dayova rule onto the new upstream wording.
- Keep project-only wrapper and design-token policy local.
- Prefer contributing generic corrections, such as animation selection
  guidance, to Expo upstream so their local hunks can eventually be removed.

Regenerate the patch against the normalized upstream catalog, rerun the updater,
and review the complete Expo diff before committing.

When a checked replacement reports a checksum mismatch, compare the complete
new upstream file with its source under `patches/expo-skills/files/`. Incorporate
useful compatible guidance into the local source, update `upstreamSha256` to the
normalized upstream file hash, and rerun the same checks. Never update the hash
without reviewing the changed upstream content.
