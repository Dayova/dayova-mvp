# DAY-528 validation — 17 October 2026

## Current integrated stack

Native stack #810 remains `main -> #661 -> #748 -> #895`.
Repaired parent #661: `d169c77d4c932b49660379f3e3607db81adda153`;
direct base #748: `5555469073ca9f78d9df07f9d50757fee7170abd`.
All three PRs are mergeable. The earlier evidence below is historical.

- #661 merged current main and resolved the shared sheet/input conflicts using
  main's keyboard-aware input context, with a password-field regression.
- New main APIs for personal subjects, dashboard and preparation now enforce
  deletion barriers. A regression reproduced the missing barrier, then passed
  across seven public API paths; another account remains unaffected.
- The deletion fixture count includes main's new personal-subject row. Vitest
  uses two workers and 30-second timeouts, including native Expo subprocess
  tests, to address the reproduced worker contention and timeouts.
- Real EAS CI on all three layers passed lint, TypeScript, tests, Convex preview
  deployment, native fingerprints and production OTA checks. Their reports cover
  the exact heads; these PR runs published no OTA.
  [#661 run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14ae2-d8a2-7144-8d8f-e5b641ca68ac),
  [#748 run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14ae2-d5c7-73d1-a35f-d404cdf9c8a6),
  [#895 run at d19bd131](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14ae2-d8b9-7935-954e-c359a8eb4902).
- PR triggers now cover `codex/**` stack bases while preserving repository and
  contributor trust gates and main-only release rules. The official EAS schema
  validates (its union types require Ajv's `allowUnionTypes`); 37 existing workflow
  regressions passed. The two-line trigger change was manually reviewed after
  CodeRabbit reached its limit. Earlier manual dispatches skipped checks due to
  their GitHub-event conditions; only the real PR runs above count as full CI.
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
The shared dev deploy rejected data from another branch; no data was changed to
force it. Jakob explicitly confirmed server-side Clerk-key transfer and the
three-event endpoints for test, then production, before they were configured.

The real provider rehearsal passed with one newly created disposable Clerk
development account and one contact in the isolated test CRM source:

- Verified the backend key against Clerk's `/v1/instance` before any account write.
- Real Clerk `user.created`, `user.updated`, `user.deleted` deliveries all succeeded
  (Svix: three successful deliveries, zero errors).
- Initial dry-run: 15 unmatched existing test contacts, one proposed new signup,
  zero conflicts/proposed identity bindings/failures. Live created exactly one
  synthetic contact; existing test contacts were unchanged.
- A verified primary-email change updated the same Convex user and same Notion
  page. A sync with the old identity email retained the new address. The manually
  seeded CRM note survived.
- Deleted only that disposable development account through Clerk. Its real event
  completed the pipeline: Convex user removed, terminal tombstone without email,
  `stage=complete`, `crmDeletionVerified=true`, operational identity references
  removed. Re-sync under the deleted identity was rejected.
- Notion readback: page retained, `App Account Status=deleted`, deletion date set,
  Clerk/Convex IDs cleared; new email, name, manual CRM status and note retained.
- RevenueCat and PostHog are not configured in this isolated fixture; their stages
  explicitly reported `notConfigured`. This does not certify their real erasure,
  R2-upload cleanup or native-device account deletion.
- Test CRM switches were reset to `off` and its endpoint disabled after success;
  the three successful delivery records remain available for inspection.

Notion's two required account-status properties were added and verified separately
in test and production. Normal production CRM delivery is already live (DAY-366:
eight new contacts, 61 verified links, two isolated founder-review cases).
Lifecycle production activation still requires matching Clerk configuration and
production processor setup. Its endpoint is prepared but disabled until rollout.
RevenueCat deletion credentials exist in production;
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
