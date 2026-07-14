# Matt Pocock Skill Maintenance

The repository installs the upstream `mattpocock/skills` package and layers Dayova-specific tracker and Codex compatibility on top.

## Sources of truth

- `skills-lock.json` records the upstream package version and hashes. Do not rewrite its hashes to hide local adaptations.
- `AGENTS.md` and `docs/agents/` define Dayova's runtime context: Linear is canonical, triage roles use explicit label mappings, and domain documentation is multi-context.
- `.agents/skills/setup-matt-pocock-skills/issue-tracker-linear.md` is the reusable Linear seed for future setup runs.

## After an upstream refresh

Run the update, then inspect the full diff before accepting it:

```sh
npx skills@latest add mattpocock/skills
git diff -- .agents/skills skills-lock.json
```

Preserve upstream workflow improvements, then reapply and validate the local compatibility layer:

1. Remove unsupported Codex frontmatter such as `disable-model-invocation` and `argument-hint`. Keep `name` and `description`; use only keys accepted by Codex's skill validator.
2. Confirm `setup-matt-pocock-skills` still offers Linear as a first-class tracker and references `issue-tracker-linear.md`.
3. Confirm tracker-aware skills follow `docs/agents/issue-tracker.md` rather than inferring GitHub from the git remote.
4. Confirm publishing skills apply one mapped category role and one mapped triage disposition role.
5. Validate every `mattpocock/skills` entry in `skills-lock.json` with the `skill-creator` validator.
6. Verify the required labels through the Linear connector and, while GitHub sync remains enabled, verify their GitHub mirrors.
7. Confirm that triage still invokes `$inspect-video-evidence` for embedded videos and screen recordings before verification, with full-timeline coverage and timestamped observations.

Do not regenerate accurate `docs/agents/*.md` files from an upstream template merely because the package changed. Rerun the setup workflow only when the tracker, label mapping, or domain-doc layout changes.

## Required Linear labels

Triage labels are mapped in `triage-labels.md`. Wayfinder additionally requires:

- `wayfinder:map`
- `wayfinder:research`
- `wayfinder:prototype`
- `wayfinder:grilling`
- `wayfinder:task`
