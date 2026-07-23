# Matt Pocock Skill Maintenance

The repository installs the upstream `mattpocock/skills` package and layers Dayova-specific tracker and Codex compatibility on top.

## Sources of truth

- `skills-lock.json` records the upstream package version and hashes. Do not rewrite its hashes to hide local adaptations.
- The Matt Pocock skill set is curated. The current allowed set is enforced by `scripts/skills-policy.mjs`; do not keep new upstream skills merely because the updater downloaded them. Add or remove a Matt skill only as an intentional workflow decision, and update the policy and this document in the same change.
- `patches/matt-pocock-skills/dayova.patch` is Dayova's text overlay on top of upstream Matt skill bodies. Keep repo-specific workflow changes there so future upstream refreshes reapply them instead of overwriting them.
- Each `.agents/skills/<skill>/agents/openai.yaml` file is Dayova's Codex invocation/UI metadata overlay. The Matt updater copies this metadata from the current workspace after applying upstream text changes.
- `AGENTS.md` and `docs/agents/` define Dayova's runtime context: Linear is canonical, triage roles use explicit label mappings, and domain documentation is multi-context.
- `.agents/skills/setup-matt-pocock-skills/issue-tracker-linear.md` is the reusable Linear seed for future setup runs.

## After an upstream refresh

Do not run the raw upstream installer in the repository. Use the composition command:

```sh
pnpm skills:update:matt -- --check
pnpm skills:update:matt
git diff -- .agents/skills skills-lock.json patches/matt-pocock-skills scripts/skills-policy.mjs
```

The updater fetches upstream into an isolated temp workspace, keeps Dayova's curated skill set, normalizes Codex frontmatter to `name` and `description`, applies `patches/matt-pocock-skills/dayova.patch`, restores local `agents/openai.yaml` metadata, validates the result, and replaces only Matt-managed skill folders and Matt lock entries. It refuses to overwrite dirty Matt skill paths.

Preserve upstream workflow improvements, then reapply and validate the local compatibility layer:

1. If `pnpm skills:update:matt -- --check` reports changes, run `pnpm skills:update:matt` and inspect the full diff before accepting it.
2. If the patch queue no longer applies, reconcile upstream changes into `patches/matt-pocock-skills/dayova.patch` instead of hand-editing installed skill text.
3. Preserve the curated Matt skill set. If upstream adds skills outside Dayova's curated set, leave them out unless the team explicitly decides to add a workflow. If upstream removes or renames one of Dayova's curated skills, replace it with the current upstream successor or remove it intentionally.
4. Confirm `setup-matt-pocock-skills` still offers Linear as a first-class tracker and references `issue-tracker-linear.md`.
5. Confirm tracker-aware skills follow `docs/agents/issue-tracker.md` rather than inferring GitHub from the git remote.
6. Confirm publishing skills apply one mapped category role and one mapped triage disposition role.
7. Run `pnpm skills:validate`; this checks the curated Matt set, Matt Codex metadata, and the composed Expo catalog.
8. Validate every changed `mattpocock/skills` entry with the `skill-creator` validator when its `SKILL.md` changed.
9. Verify the required labels through the Linear connector and, while GitHub sync remains enabled, verify their GitHub mirrors.
10. Confirm that triage still invokes `$inspect-video-evidence` for embedded videos and screen recordings before verification, with full-timeline coverage and timestamped observations.

Do not regenerate accurate `docs/agents/*.md` files from an upstream template merely because the package changed. Rerun the setup workflow only when the tracker, label mapping, or domain-doc layout changes.

## Codex invocation policy

Most Matt orchestration skills are user-invoked in Codex through `agents/openai.yaml` (`allow_implicit_invocation: false`) to avoid loading the full workflow catalog into every task. This is expected. Do not treat a hidden orchestration skill as missing merely because it is absent from the model-invoked skill list; check `.agents/skills/<name>/SKILL.md` and `skills-lock.json`.

If a skill must route autonomously from ordinary user language, make that an explicit change to `agents/openai.yaml` and rerun `pnpm skills:validate`.

## Required Linear labels

Triage labels are mapped in `triage-labels.md`. Wayfinder additionally requires:

- `wayfinder:map`
- `wayfinder:research`
- `wayfinder:prototype`
- `wayfinder:grilling`
- `wayfinder:task`
