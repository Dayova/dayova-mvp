# DAY-528 validation

## Main integration refresh — 18 October 2026

Parent #661 is `98574de3a64cb018abc1f464afd1632b41218734`; direct base #748 is
`3c32c5e5e1cf6ad63bec89bf1d47065623642ee9`. Both include main
`006f88eb6557f60cf9628edd7604859795b38926`. See the latest #895 head for this
layer's integration; all sections below describe earlier named snapshots.

The only parent merge conflict was PR workflow routing. The resolution adopts
main's accepted all-target trigger configuration and retains repository and
contributor trust gates plus main-only production deployment/publication.
Formatting-only changes repair two deletion-related CRM test files. The lifecycle
layer registers its documented standalone local smoke script as a specific Knip
entry point, consistent with the repository's existing helper entries.

Parent validation passed formatting, lint, unused-code checks, skill validation,
TypeScript, all **145 Vitest files / 1,141 tests**, **18 Node tests**, and **46
focused UI tests** covering account deletion and the changed shared controls.
The combined stack passed formatting, lint/TypeScript, unused-code checks, skill
validation and all **148 Vitest files / 1,165 tests**. The workflow matches the
current official EAS schema (its union declarations require `allowUnionTypes`).
The full local UI runner again stalled in unchanged preparation/session tests;
a single complete local UI invocation is not claimed. Fresh remote CI must
validate the resulting heads. Conflict resolution and the narrow formatting/Knip
changes were manually reviewed.

Existing OTA incompatibility and production policy/device/provider gates remain.
No production activation or release is part of this integration refresh.

## Earlier concurrent-request follow-up — 18 October 2026

At this snapshot, parent #661 was `f2c48fe7825f5f87844a774285bb5d0c6d7a3b32`; direct base #748
is `74b37e4c5b8633b423efeea7b342b496953c980d`. Integration commit
`74810e96aae70d4f12691d87416005d5f01a2e03` carries both into #895.

One additional regression submits verified requests concurrently and verifies a
shared accepted request ID, one tombstone, and read/write access denial after a
cleanup failure enters retry state. The focused deletion selections pass: four
files / 35 tests on the parent and four files / 36 tests on the combined stack.
TypeScript and changed-file ESLint pass. The test was reviewed manually; the
previously reported CodeRabbit CLI quota still applies. Runtime code is unchanged
by this follow-up. Fresh CI and OTA reports must cover the new heads.

The full-suite counts and successful CI/development push below describe the
preceding implementation snapshot, before this additional test.

## Earlier readiness snapshot — 18 October 2026

Native stack #810 remains `main -> #661 -> #748 -> #895`. Parent #661 is
`83a26edc95a233d160231d93cf4bf466ca2e271c`; direct base #748 is
`7eca83984989e8e6a99b189cb656090034fdebed`. The top layer incorporates both in
integration commit `1c0b11b0788ecc523fadb47d54b3bebae28e5137`.

The refresh preserves current main through `b80cf796`, stops losing deletion
workers from scheduling duplicate continuations, and includes the same guard on
the final data-to-Notion transition. Five concurrent-worker regressions pass.
Both deletion screens now retain verification failure reasons and clear the
password after a failed attempt. The runbook describes the authenticated HTTP
password-verification flow.

Combined-stack lint/TypeScript and **146 Vitest files / 1,135 tests** passed.
The combined backend compiled and pushed to development `utmost-oriole-983`;
missing-request action/query smoke checks and unauthenticated HTTP rejection
(401) passed. Parent and direct-base required CI have passed on the hashes above.
The lifecycle layer's latest CI and OTA reports must cover its latest head.
Production activation and the documented policy/device/provider gates remain open.

The sections below are historical evidence from 17 October and earlier. Their
commit hashes and validation counts describe those earlier snapshots.

## Historical stack refresh after main merged PR #857 — 17 October 2026

Main advanced to `110d166e` after the previous successful stack checks. Its
interaction-feedback change conflicted with #661's Paywall imports. Merge
`ab9fddd349179b12730dfeeb0d1e94a822b526f5` preserves both the new feedback controls
and secure account-deletion password/keyboard handling. The merged parent passed
repository lint/TypeScript, **142 Vitest files / 1,098 tests**, and **103 Jest
suites / 541 tests**. Two additional NativeWind runtime regression cases then
verified class padding and explicit styles on both animated control variants
(15 tests in that suite); TypeScript and changed-file lint passed again.
CodeRabbit's integration review requested this style verification; it passed
without changing the controls. The added tests were reviewed manually.

All #748 and #895 commits were rebased without conflict; `git range-diff` shows
every replayed commit unchanged. The refreshed direct base #748 is
`2c185b5e94d15c8306a26427415bf4492e13d1a7`. Native stack #810 and all PR identities
remain unchanged. Earlier commit hashes/checks below describe the prior stack.
The refreshed top layer passed repository lint/TypeScript and the complete
**145-file / 1,121-test Vitest suite** before the final evidence-only commit.
Fresh remote checks must cover the new heads; no previous green check substitutes
for them. Production lifecycle activation still follows protected merge/deploy.

The remaining PR review note requested issuer/key consistency verification. A
read-only production preflight confirmed a canonical issuer without a trailing
slash/whitespace and **77/77 existing user identity prefixes matching exactly**.
The Clerk configuration and retained-contact rehearsal above verify the matching
development instance. No identity keys were normalized or rewritten. The runbook
now explicitly requires this issuer preflight before activation/config changes.

## Historical integration before the PR #857 refresh

Native stack #810 remains `main -> #661 -> #748 -> #895`.
Repaired parent #661: `d169c77d4c932b49660379f3e3607db81adda153`;
direct base #748: `5555469073ca9f78d9df07f9d50757fee7170abd`.
All three PRs have no merge conflicts. GitHub still requires an approving review
for each layer; the native stack's enqueue action is disabled until then.
The earlier evidence below is historical.

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
Lifecycle production activation still requires the protected stack merge and
deployment. Matching Clerk API/signing/instance configuration is now stored in
production; its three-event endpoint is prepared but disabled until rollout.
RevenueCat deletion credentials already exist in production. Separate PostHog
personal keys are now stored only in their matching backends: Production 190091
on `sleek-bulldog-130`, Dev 190100 on `utmost-oriole-983`, EU API host. Each has
only `person:write`, which also permits the required person lookup. Both matching
lookups returned 200; cross-project access returned 403 in both directions.

A second disposable Clerk development account verified the configured PostHog
stage through the real Clerk deletion webhook and deployed Convex worker:
`status=completed`, `stage=complete`, `clerkStatus=completed`,
`postHogStatus=completed`, `crmDeletionVerified=true`, zero retries. The synthetic
PostHog person existed before deletion and was absent afterward, as was the
Convex user. A separate direct API probe accepted the worker's exact DELETE URL
with `delete_events=true&delete_recordings=true` (202). PostHog processes erasure
asynchronously; these observations verify acceptance and profile removal, not
physical completion of event/recording purges. No recording was seeded.
RevenueCat remained `notConfigured` in the isolated fixture. Test CRM switches
were reset to `off` and the development endpoint disabled again after the probe.

The final pre-handoff code/evidence head `c3918b8d` passed every remote check,
including its fresh OTA report:
[EAS run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14b35-356f-781d-81bb-555a3e258b53).
This subsequent update changes evidence only. No historical production account
was repaired, deleted or merged by email; DAY-357's broader matrix is not certified.

After approval, enqueue the native stack, wait for the merged production Convex
deployment, verify its function/configuration readback, then set production
`NOTION_CRM_DELETION_MODE=live` and enable the prepared production Clerk endpoint.
Keep the already-live `NOTION_CRM_MODE=live`. Historical reconciliation stays
read-only unless a specific account repair is separately authorized.

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
