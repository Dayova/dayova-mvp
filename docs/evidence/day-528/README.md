# DAY-528 validation — 17 October 2026

## Current integrated stack — 19:10 CEST

Native stack #810 remains `main -> #661 -> #748 -> #895`.
Repaired parent #661: `3df0ab08fd2c2750ecb4e2d4b1a4120482deeb92`;
direct base #748: `39c4165cff0c561716b2f51fb0a8c6ccd5c3543c`.
All three PRs are mergeable. The earlier evidence below is historical.

- #661 merged current main and resolved the shared sheet/input conflicts using
  main's keyboard-aware input context, with a password-field regression.
- New main APIs for personal subjects, dashboard and preparation now enforce
  deletion barriers. A regression reproduced the missing barrier, then passed
  across seven public API paths; another account remains unaffected.
- The deletion fixture count includes main's new personal-subject row. Vitest
  uses two workers and 30-second timeouts, including native Expo subprocess
  tests, to address the reproduced worker contention and timeouts.
- Real EAS CI on #661 passed lint, TypeScript, tests, Convex preview deployment,
  native fingerprints and production OTA checks. The OTA-compatible report covers
  the exact head above; this PR run published no OTA.
  [EAS run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14ac1-cd94-7e1a-8a6b-235e0d58ee15).
- `git range-diff` confirms #748's implementation survived unchanged; #895's
  replay differs only in generated API context for newly added main modules.
- Complete top-stack Vitest: **145 files / 1,120 tests passed** before the final
  completion guard. Final focused lifecycle/deletion selection: **27 passed**,
  including a new processor-level no-match completion/disabled-cleanup retry test.
- Complete Jest UI: **102 suites / 525 tests passed**. These UI/test files are
  identical in #661 and the top layer. Supporting Node scripts: **18 passed**.
- Repository `pnpm check` passed again after the completion guard. Both isolated
  local and cloud Convex pushes succeeded. The fresh local signed HTTP smoke
  again produced every successful result shown below, after main integration.

CodeRabbit completed the integrated diff review. The processor now sends an
unverified completion into retry/review instead of silently stopping; the inherited
runbook now describes server password verification, retained-contact cleanup and
the actual `retryRequest` recovery operation. CodeRabbit's follow-up review of
the completion/test/runbook diff completed with zero findings; the evidence update
was reviewed manually. Reviewed suggestions not applied:
the suggested email fallback contradicts the tested verified-primary contract;
tombstones already clear email/name/payload and deliberately retain opaque replay
barrier keys. Arbitrary custom HTTP origins are outside this hosted rollout;
the regional production Cloud-to-Site hostname rewrite is correct.

For real provider rehearsal, a separate European development deployment
`utmost-oriole-983` (`dev/clerk-lifecycle-20261017`, expires after five days) is
deployed with the development Clerk issuer and isolated test CRM destination.
Both CRM switches start off. The shared dev deploy rejected data from another
branch; no data was changed to force it. A three-event Clerk endpoint is prepared,
pending browser access confirmation. Real provider delivery is not yet verified.

Notion's two required account-status properties were added and verified separately
in test and production. Normal production CRM delivery is already live (DAY-366:
eight new contacts, 61 verified links, two isolated founder-review cases).
Lifecycle production activation still requires matching Clerk configuration and
the provider rehearsal. RevenueCat deletion credentials exist in production;
PostHog deletion credentials are absent. No historical production account was
repaired, deleted or merged by email; DAY-357's broader matrix is not certified.

## Earlier implementation evidence

Native GitHub stack #810: `main -> #661 -> #748 -> #895`.
The direct base is PR #748, head `66cf73d44d8cb3c7306d30be79dabaf3d7abf0a6`;
PR #661 supplies the deletion pipeline. The original checks below used #661
at `d74da5831add803cb27abfd90ec7dfe2ae41097c` before the stack was extended.
Runtime: Node 24.18.0, pnpm 11.15.1, Convex 1.41.0.

## Checks

- After moving #895 onto #748 for native stack #810, `pnpm check` passed again
  and the complete Vitest suite passed **938 tests across 131 files**.
  `git range-diff` confirmed both implementation commits were unchanged by
  the rebase; the added base contributes only the reviewed AI-usage layer.
- `pnpm check`: repository lint and TypeScript passed.
- `pnpm exec vitest run --maxWorkers=2 --testTimeout=30000`: 130 files,
  **932 tests passed** before the final small review follow-up.
- After that follow-up, the final Clerk lifecycle/account deletion/CRM deletion
  regression selection passed **25 tests**; TypeScript and targeted ESLint passed
  again. This includes a new test for an unknown CRM destination, assertions
  against repeated deletion after completion, and foreign-issuer audit exclusion.
- Relevant Jest UI suites (session refresh, paywall, settings profile):
  **27 tests passed** across 3 suites. The profile logout-failure fixture emits
  its existing expected diagnostic; no test failed.
- All changed files pass Biome formatting/lint and `git diff --check`.

## Backend runtime smoke

The implementation compiled and deployed to an **isolated local Convex backend**.
No shared cloud development backend or production configuration was changed.
`node scripts/check-clerk-lifecycle-local.mjs` passed on the final code:

```json
{
  "deployment": "isolated local backend",
  "validWebhook": 200,
  "forgedWebhook": 401,
  "foreignInstance": 403,
  "staleJwtPreservesEmail": true,
  "staleEventIgnored": true,
  "deletionWebhook": 200,
  "deletedAccountCannotResync": true,
  "productionTouched": false
}
```

The smoke uses synthetic local identities and signed HTTP messages. It proves
the deployed HTTP/mutation/access path, not real Clerk delivery or live Notion
writes. Unit integration tests cover verified-primary selection, event ordering,
late-token protection, same-email identity isolation, retained CRM fields,
destination/identity conflicts, lost responses with minute-precision timestamps,
shared-worker exclusion and preservation of normal audit history.

## Review and rollout boundary

Two CodeRabbit review rounds covered all implementation files. Their findings
were addressed, including minute-precision deletion markers, audit-state
preservation, completed-tombstone idempotency and missing-destination recovery.
The last automated recheck hit the shared account review-capacity limit; the
small final diff was manually reviewed and verified with the regression checks
above. The Convex-specific auth/validator/index/runtime checklist was also checked.

No production account was repaired/deleted, no production webhook was configured,
and no CRM contact/schema was changed during implementation. PR #661, the two
Notion properties, provider credentials, endpoint subscription and isolated
provider/CRM rehearsal remain rollout prerequisites. See
[the lifecycle runbook](../../runbooks/clerk-lifecycle.md).
