# DAY-528 validation — 17 October 2026

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
