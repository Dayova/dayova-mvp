---
status: proposed
---

# Enforce repository checks and limit typed linting

Recorded on 2026-10-18 for [PR #846](https://github.com/Dayova/dayova-mvp/pull/846).
This record explains the implementation decisions in the PR at
`409c5cb12a062cfcc25b095f340e753e7c332a1c`; it does not imply merge approval.
The original work addresses [DAY-309](https://linear.app/dayova/issue/DAY-309/add-knip-unused-code-verification-to-eas-ci)
and [DAY-310](https://linear.app/dayova/issue/DAY-310/add-formatting-verification-to-eas-ci).

Formatting and unused-code checks existed locally but were absent from CI.
Consequently, passing CI did not establish that the repository passed its own
available checks. Restoring enforcement exposed existing cleanup work and
coverage gaps. The decision is to enforce those checks, repair the findings,
and reduce unnecessary lint setup while preserving specialized rules.

## 1. Enforce the existing checks in one shared CI job

In `.eas/workflows/ci.yml`, add named, non-mutating steps for `pnpm format:check`,
`pnpm check:unused`, and `pnpm skills:validate` alongside lint, TypeScript, and
tests. Formatting includes Tailwind class ordering. Skill validation protects
the installed catalog and Dayova compatibility overlays from drift.

Keeping these steps in the existing `checks` job gives PRs, manual runs,
merge-queue pushes, and the resulting `main` commit the same quality gate.
Sequential steps stop at the first failure and identify the failing tool.
CI checks rather than repairs source so a green result describes the committed
tree. The consequence is additional CI work and previously tolerated findings
becoming merge failures; fixing those findings is part of enabling the gate.

## 2. Run PR CI for every target branch, including stack parents

Remove only `on.pull_request.branches: [main]`. Restricting PR events to `main`
left new commits in dependent PRs without CI or a current OTA assessment while
their base was another feature branch. All target branches now qualify, with
no changed-file filter, including documentation-only PRs. Drafts are not
excluded. The event list stays `opened`, `ready_for_review`, `reopened`, and
`synchronize`; title/body edits and retargeting alone are not added as triggers.

Broader branch coverage is separate from trust: the source must still be this
repository and the author association must be `OWNER`, `MEMBER`, or
`COLLABORATOR`. Trusted PRs run fingerprints and iOS/Android production exports
plus OTA assessment after quality checks pass. Manual runs and merge-queue
pushes retain their existing validation-only routing. Convex deployment and
OTA publication still require a push to `main`, and publication still requires
the safety/dependency gates.

This deliberately increases CI usage for stacked PRs and drafts. It does not
retroactively schedule existing PRs: EAS reads the workflow at the triggering
commit, so branches must contain the change and receive a qualifying event.
See the [EAS trigger reference](https://docs.expo.dev/eas/workflows/syntax/#onpull_request)
and [workflow troubleshooting](https://docs.expo.dev/eas/workflows/troubleshooting/).

## 3. Preserve specialized lint engines and remove unnecessary UI type loading

Keep Biome for general linting/formatting, Knip for unused code/dependencies,
and ESLint for React Hooks/Compiler, Dayova UI, and Convex rules. Consolidating
tools without proving equivalent specialized coverage could silently remove
checks; this PR improves the existing split instead.

In `eslint.config.mjs`, set `projectService: false` only for UI/source parsing.
Those configured React and Dayova rules inspect syntax and do not need a
TypeScript project. Convex keeps `projectService: true` because its typed rules
need it. Rule severities, adapter exemptions, test source-scan restrictions,
and the independent full TypeScript check remain in place. A future UI rule
that requires types must revisit this boundary rather than silently assuming
typed parsing is available.

The PR reports a paired local ESLint sample of 16.22 seconds before and
9.97 seconds after, about 39% lower elapsed time. That is a local observation,
not a guaranteed CI improvement. The stronger correctness evidence is the
reported identical diagnostics across 551 files with the same 22 UI rules
and five enabled Convex rules.

## 4. Close Biome coverage gaps and normalize newly enforced files

`biome.jsonc` adds `tests/**`, `eslint/**`, `modules/**`, `.vscode/**`, and a
root JS/TS/JSON extension glob. The glob replaces the fragile root-file
allowlist, including its stale `knip.json` entry, so `knip.jsonc` and future
matching root configuration are covered. Existing source/backend/tooling
coverage remains. Generated Convex files stay generator-owned, and
`skills-lock.json` stays installer-owned and is checked by skill validation.

This expansion explains the mechanical edits to `eas.json`,
`modules/dayova-system-appearance/expo-module.config.json`, `nativewind-env.d.ts`,
`eslint/dayova-ui-plugin.mjs`, and the three ESLint rule test files
(`interface-shadows`, `native-controls`, `no-direct-overlay-primitives`).
These normalize formatting without changing native configuration or rule intent.
The formatting in `eslint.config.mjs` accompanies the parsing change above.

The same normalization explains edits to existing tests named
`android-play-release`, `expo-skills`, `ios-apple-sign-in-capability`,
`ios-privacy-config`, `ota-pr-workflow`, `ota-report-freshness`, `ota-safety`,
`ota-source-diagnostics`, `package-scripts`, `png-git-attributes`,
`pnpm-toolchain`, and `production-ota-publication`, plus
`tests/mocks/selection-reanimated.cjs` and
`tests/fixtures/production-ota-baseline.schema-1.json`. Intentional literal
`${{ ... }}` workflow strings use escaped template literals where required by
Biome; the resulting strings and assertions retain their meaning. The added
workflow assertions are a separate behavior change described below.

`scripts/publish-production-ota.mjs` is also reformatted. Its source checks,
publication lock, platform handling, and failure behavior are retained; these
lines do not introduce a new release mechanism. Normalizing the baseline now
avoids enabling a gate that immediately fails on existing files, at the cost
of a larger mechanical diff.

## 5. Make Knip findings actionable instead of suppressing the repository

`knip.jsonc` declares real standalone entry points under `docs/evidence/**/*.mjs`
and `release/**/scripts/*.cjs`, and dynamically loaded `tests/mocks/*.cjs`.
Those files are executed outside the ordinary import graph. It records
`maestro` as an externally installed binary and retains named exceptions for
dependencies resolved outside normal imports: the existing Babel/skills cases
and the `expo-font`/`expo-splash-screen` config plugins. These targeted declarations
avoid deleting valid tooling or hiding whole source directories from analysis.

`package.json` declares `sharp` as a development dependency because the
screenshot helper actually imports it. `pnpm-lock.yaml` records that dependency
and its resolved platform packages; the lockfile expansion is tooling support,
not an intended native app dependency upgrade.

Remove code with no consumers rather than add Knip exceptions for it:

- `src/features/learning-plans/learning-plan-ui.tsx` loses the unreachable
  `SectionTitle`, `PlanningHintBanner`, and `SessionCard` implementations and
  their exclusive helpers/imports. `learning-plans/utils.ts` loses the now-unused
  day/weekday formatters. These deletions remove obsolete implementations,
  rather than removing a screen used by the current app.
- Delete the unused `learning-plans/constants.ts` status-label module and
  `src/types/validation.ts` attribution-label module. Their removal is unused
  code cleanup, not a change to persisted status or attribution vocabularies.
- `src/components/ui/icon.tsx` loses the unused `Analytics`, `Fire`, `Home`, and
  `Settings` wrappers and their imports; used icons remain.
- Keep locally used implementations/types private in `entry/exam-flow.tsx`,
  `onboarding/onboarding-learning-times.ts`, `onboarding/onboarding-select.tsx`,
  `auth/dayova-auth-flow.tsx`, `dashboard/dashboard-agenda.ts`,
  `dashboard/dashboard-day-header.tsx`, `dashboard/dashboard-layout.ts`,
  `learning-plans/learning-path-node-presentation.ts`,
  `learning-plans/plan-workload.ts`, `learning-plans/session-progress.ts`,
  `learning-plans/types.ts`, `learning-times/learning-time-editor-fields.tsx`,
  `subjects/subject-catalog.ts`, `timetable/timetable-editor.ts`,
  `timetable/timetable-week-editor.tsx`, `src/lib/ai-consent.ts`,
  `src/lib/runtime-config.ts`, and `scripts/ota-safety.mjs`. Component paths here
  are under `src/components/`; feature paths are under `src/features/`.
  Removing unused exports narrows module APIs while preserving their internal
  callers, values, validation, and persisted paired-session suffix.
- The change to `learning-plans/use-prepare-session-content.ui.test.tsx` is
  formatting of its existing consent assertion, accompanying this cleanup.

The cost is that removed speculative APIs must be deliberately restored if a
future caller needs them. The benefit is a gate that reflects real reachability
and dependencies rather than an accumulation of broad suppressions.

## 6. Verify that tool configuration still rejects invalid code

Add `tests/eslint-config.test.ts` to execute the effective configuration against
invalid and valid fixtures. It verifies the parsing boundary, Dayova adapters,
React Hooks/Compiler checks, source-scan restrictions, and all five Convex rules.
Configuration inspection alone would not prove the rules still diagnose code.

Add `tests/biome-coverage.test.ts` with 13 location fixtures asserting exact
diagnostic IDs for `debugger` and duplicate JSON keys. Use RDJSON because the
experimental JSON reporter did not correctly escape Windows paths. This repairs
diagnostic transport while retaining the tested locations and rule assertions.

Extend `tests/ota-pr-workflow.test.ts` to guard all-target PR routing, the complete
ordered shared-check command list, and PR/main/merge-queue job eligibility.
Existing fork, contributor, deployment, and OTA tests remain the safety checks.
The extra fixtures add test time in exchange for making silent coverage loss
observable when configurations change.

## 7. Repair native smoke setup exposed during verification

These Maestro changes make the existing journeys usable with the current
development client and screen geometry; they are not new product navigation:

- `app-launch.yaml` expects the current first onboarding headline,
  `Schluss mit Aufschieben.`, instead of obsolete copy.
- `shared/launch-unauthenticated.yaml` closes the development menu with the
  platform's available action: Close on iOS and Back on Android. It also accepts
  the iOS accessibility prefix on the exact expected disabled-PostHog warning,
  so the banner can be dismissed without matching unrelated warnings.
- New `shared/dismiss-auth-keyboard.yaml`, used by `login-validation.yaml` and
  `password-recovery.yaml`, taps the non-interactive heading on iOS before
  confirming keyboard dismissal. Email keyboards otherwise lack a dismiss key.
- `onboarding-navigation.yaml` hides the Android keyboard after name entry so
  the footer is reachable, then scrolls informational-step actions into view
  on short screens. Existing validation assertions/actions are retained, and
  existing timeouts are not relaxed.

Platform-specific setup adds maintenance, but prevents harness obstruction from
being mistaken for an application regression. Native verification also exposed
an Android startup race; its C++ fix belongs to the separate
[#886 / DAY-524 prerequisite](https://github.com/Dayova/dayova-mvp/pull/886).
That prerequisite was integrated while preserving history; it is not a new
tooling decision in #846. Shipping that fix requires a new native binary and
cannot be justified by an OTA-only validation result.

## 8. Keep the decisions discoverable and evidence scoped

`README.md` corrects the description of `pnpm test` to include Vitest, Node,
and Jest UI suites, and lists skill validation and the existing Compiler health
command so contributors can find them. It does not add the Compiler health
command as a CI gate. `docs/contexts/platform/CONTEXT.md` records the stable
tool ownership, CI routing, and coverage contracts; this ADR explains why they
were chosen.

The [PR description and validation history](https://github.com/Dayova/dayova-mvp/pull/846)
retain the check results, native run links, source hashes, failed-attempt
accounting, and review scope. Those are historical results for their named
commits, not fresh acceptance evidence produced by writing this record. Future
retrospectives should compare CI duration/failure causes, stacked-PR report
freshness, and rule coverage before reconsidering the extra gates or tool split.
