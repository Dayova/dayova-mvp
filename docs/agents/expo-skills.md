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

To validate the installed composed catalog without network access, run:

```sh
pnpm skills:validate:expo
```

## Validation commands

Use the commands for different scopes:

- `pnpm skills:validate` validates repository-owned skill state only: the curated
  Matt set, Matt Codex metadata, and the installed composed Expo catalog.
- `pnpm skills:validate:expo` validates only the installed repo-local Expo
  catalog, without network access.
- `pnpm skills:validate:catalog:codex` validates repository-owned skill policy
  plus the contributor's local Codex config. It is intentionally separate from
  `pnpm skills:validate` because local Codex config is machine-specific and
  should not make normal repository validation non-portable.

## Codex plugin overlap

The installed `expo:` plugin may expose upstream Expo skills that duplicate this
repo's composed Dayova skills. Keep these plugin skills disabled in Codex config
so agents load the repo-local skill instead:

- `expo:building-native-ui`
- `expo:expo-api-routes`
- `expo:expo-cicd-workflows`
- `expo:expo-deployment`
- `expo:expo-dev-client`
- `expo:expo-module`
- `expo:expo-tailwind-setup`
- `expo:expo-ui-jetpack-compose`
- `expo:expo-ui-swift-ui`
- `expo:native-data-fetching`
- `expo:upgrading-expo`
- `expo:use-dom`

`expo:codex-expo-run-actions` is not duplicated by the repo-local catalog and may
remain enabled.

To verify local Codex config, run:

```sh
pnpm skills:validate:catalog:codex
```

Run this command when:

- enabling, reinstalling, or updating the Expo plugin;
- editing local Codex skill configuration;
- changing the repo-local Expo skill composition or duplicate policy;
- debugging unexpected Expo skill triggering;
- verifying a claim that duplicate Expo plugin skills are disabled.

Interpret the result as follows:

- `Skill catalog and Codex Expo plugin configuration are valid.` means the
  curated repo skill policy is valid and, if the Expo plugin is enabled locally,
  every known duplicate plugin skill is disabled.
- `Warning: Codex config not found...` means the repository checks ran, but the
  local Codex duplicate check was skipped because the config file was not found.
  Set `CODEX_CONFIG_PATH` if Codex is using a nonstandard config path, then rerun
  the command.
- `Warning: Expo plugin is not enabled...` means the duplicate check was skipped
  because there is no enabled Expo plugin to conflict with repo-local skills.
  That is acceptable for contributors who do not use the plugin locally.
- `Duplicate Expo plugin skill must be disabled...` means the local Expo plugin
  is enabled and a listed `expo:` plugin skill is not explicitly disabled. Fix
  the contributor-local Codex config; do not remove the repo-local skill to make
  this pass.

To remediate a duplicate-skill error, add or update a local Codex config entry
for each reported skill:

```toml
[[skills.config]]
name = "expo:expo-dev-client"
enabled = false
```

Repeat the block for every reported duplicate, then rerun:

```sh
pnpm skills:validate:catalog:codex
```

If the duplicate is intentional because Dayova decided to use the plugin skill
instead of the repo-local skill, update `scripts/skills-policy.mjs`, this
document, and the repo-local skill catalog in the same change.

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
