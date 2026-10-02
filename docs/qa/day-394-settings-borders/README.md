# DAY-394 — Settings and profile group borders

Related: [DAY-394](https://linear.app/dayova/issue/DAY-394).
Base: `main` at `a553f8f3a1c0999929803b4815b7ea0c932ab2db`.
Date: 2026-10-02. Status: implementation tested; native acceptance blocked.

## Scope and decision

The original issue asked for subtle, consistent borders on multiple surfaces,
including groups on the former More screen. Merged PR #605 changed only the
learning-plan topic field, not the settings groups. Its merge is not evidence
that all DAY-394 acceptance criteria were completed.

Job: distinguish settings groups from the background. Hierarchy: group title,
group surface, then individual actions. Primary actions and navigation remain
unchanged. Friction: white cards blend into the light background. Decision:
apply the existing `border border-border` treatment to shared `SettingsCard`,
matching the existing input border token, retaining radius, padding, dividers,
theme adaptation and shadow-free styling. Do not change Surface globally.

## User screenshot inventory (report evidence only)

Originals remain local; they contain real profile data and are not published.
The installed build/update revision cannot be established from these images.

| Image | Visible surface | Finding and coverage |
| --- | --- | --- |
| IMG_1934.PNG / IMG_1932.PNG | Profile entry, support, learning times, App group | No visible outer group stroke; all use SettingsCard directly or through SettingsSection. |
| IMG_1933.PNG | App, subscription, privacy/legal groups | Same missing outer stroke; existing internal separators remain. |
| IMG_1929.PNG | Profile inputs and Safety/account group | Inputs already have borders; only the account group requires this fix. |

The implementation covers those groups through their shared component. It does
not certify Dashboard, analysis, onboarding, the bottom navigation, or all other
DAY-394 surfaces. No account mutations or backend/deployment changes are included.

## Reproduction and validation

Command: `pnpm exec jest --runInBand --watchman=false --runTestsByPath src/features/settings/settings-list.ui.test.tsx`.

Before: both cases failed. Rendered host classes were `rounded-card bg-card
shadow-none overflow-hidden p-2`; `border` and `border-border` were absent.
After adding those two classes: both cases pass. These are rendered-component
class-contract assertions, not pixel measurements or native screenshots.

Combined settings-list, settings-screen and profile-screen suites: 3 suites,
12 tests passed. The profile logout-error test intentionally logs its simulated
503 error. TypeScript, targeted ESLint, Biome and diff checks passed.

## Native evidence blocker

A dedicated iOS 26.4 simulator was created to avoid disturbing other QA sessions.
Installation of the existing development client failed with
`IXUserPresentableErrorDomain code=11` (insufficient storage). After removing
only that newly created empty simulator, the host reported about 190 MiB free.
No existing apps, simulator data, or user files were deleted. The temporary
component fixture and entry-point modification were removed.

No new native before/after screenshots or recordings were captured. Android,
dark-mode pixels, large text and full authenticated flows remain unverified.
There is no claim of full-suite CI, successful native export, release or merge.

## Review gate and repeatable acceptance

Follow the [canonical review checklist](https://app.notion.com/p/3dc2e87228bf81c69e43cadf318c2d9f).
Keep the PR draft until these are satisfied:

- Free sufficient disk space without deleting unrelated work.
- Run base and final head with the same synthetic account and pinned runtime.
- On iOS and Android, capture settings top/bottom and profile account group;
  compare light/dark and enlarged text; preserve existing input borders.
- Exercise profile navigation, support, learning times, appearance choice and
  return navigation without saving profile changes or confirming destructive actions.
- Attach before/after screenshots AND before/after recordings directly to the PR,
  labelled with base/head, device, OS, runtime and scope. Do not upload the supplied
  account-bearing originals as public test fixtures.
- Run current checks/build validation and obtain human review. A green component
  test does not satisfy the native evidence gate or the entire DAY-394 issue.
