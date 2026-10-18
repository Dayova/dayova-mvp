# Clerk account lifecycle (DAY-528)

Execution: [DAY-528](https://linear.app/dayova/issue/DAY-528).
Depends on the server-authoritative deletion pipeline in PR #661 / DAY-358.
Former native GitHub stack #810 was `main -> #661 -> #748 -> #895`.
PRs #661 and #748 have merged; #895 now targets main directly, retaining their
deletion guards and background AI usage.

## Ownership and behavior

Clerk owns account existence and the verified primary email. The signed endpoint
`POST /clerk-webhook` accepts `user.created`, `user.updated` and `user.deleted`
only from the configured Clerk instance. Authentication still creates the Convex
profile, onboarding and signup queue; a webhook does not bypass that flow.

The key is the configured JWT issuer plus Clerk user ID, exactly the same as
Convex's `tokenIdentifier`. Names and email addresses never bind identities.
Updates compare Clerk `updated_at`, then the event's millisecond timestamp.
Duplicates and older snapshots do nothing. Once a Clerk snapshot is available,
cached JWT email claims cannot overwrite it. Only the explicitly selected,
verified primary address is projected; a verified secondary is not a substitute.

A verified deletion immediately creates a minimal identity tombstone and enters
the existing deletion pipeline after the already-completed Clerk steps. An
in-app verified deletion creates the same tombstone. It survives completion, so
old tokens and late create/update events cannot resurrect the account. The
tombstone contains opaque identity keys and ordering/deletion timestamps, never
an email, name or raw event. Under Jakob's 18 October DAY-357 decision,
successful pipeline completion starts its 90-day retention clock. The 30-day
audit cleanup cannot remove this separate barrier. Unresolved failures do not
start expiry; barriers without confirmed completion remain fail-closed.

Hourly bounded cleanup expires completed audits after 30 days and completed
barriers after 90 days. Independently, lifecycle mutations ignore event
timestamps at least 90 days old, even when a replay carries a fresh signature.
For legitimate older missed updates, use the read-only audit and explicit
per-account reconciliation below; repair fetches current Clerk state rather
than trusting an old event payload. A new Clerk identity is still a new account.

Before activation, verify that accepted Convex JWTs expire before the 90-day
barrier window and that deleted Clerk accounts cannot refresh them. Before any
backup restore, pause lifecycle/CRM delivery and application writes, restore
deletion/replay evidence, and reconcile restored accounts against live Clerk
before resuming integrations. Never restore a pre-deletion snapshot directly
into a live integration. Database expiry does not certify provider backup expiry.

## CRM decision approved by Jakob on 17 October 2026

Keep the CRM contact and its profile/contact information, notes, research,
relationships, tags, registration date and manually managed CRM status/history.
The current app link/access projection is removed and separately marked:

- `App Account Status`: select with exact values `active`, `deleted`.
- `App Account Deleted At`: date, containing the accepted deletion timestamp.
- Clerk and Convex IDs, current subscription product/store/expiry, grace/trial
  dates and renewal flag are cleared. Current entitlement/payment/plan become
  `none` / `None` / `None`; identity status becomes `unmatched`.

This is contact retention, not a claim that every independent CRM record is
deleted. The broader processor/privacy approval remains DAY-357's responsibility.

Convex data is removed before the `deleteNotion` stage. The deletion request
retains the exact Notion destination and page ID until readback verifies cleanup.
No match means no contact to update. Duplicate identities, a changed destination
or a reassigned page require review. A lost PATCH response is recovered using the
persisted page ID and deletion marker, even after the Clerk ID has been cleared.
Retries share the normal CRM worker lease, so an older in-flight projection
finishes before cleanup. Deleted identities cannot generate later projections.
CRM cleanup never archives a page or changes access in the app.

## Configuration and rollout

1. Keep production CRM delivery and deletion delivery disabled during setup.
   Add the two CRM properties above, with their exact types/options, to each
   intended test/production Students data source **before deploying this change**.
   Existing CRM projection properties are unchanged in meaning.
2. Set server-only `CLERK_WEBHOOK_SIGNING_SECRET`,
   `CLERK_WEBHOOK_INSTANCE_ID` and the existing `CLERK_JWT_ISSUER_DOMAIN` on the
   intended deployment. The signing secret is the endpoint's `whsec_...` secret,
   not a Clerk API secret. Development must use the development Clerk instance.
   Verify the issuer equals Clerk's JWT `iss` and the issuer prefix in existing
   Convex `tokenIdentifier` values exactly, with no whitespace or trailing slash.
   Do not normalize identity keys independently in lifecycle or reconciliation:
   all three paths must use the same issuer. Stop activation if this preflight
   differs; do not rewrite existing identities to make it pass.
3. Configure the Clerk endpoint to the deployment's `.convex.site/clerk-webhook`
   URL and subscribe to the three `user.*` events above. Test valid delivery,
   invalid signature/instance rejection and a verified primary-email change.
4. Verify the inherited DAY-358 processor credentials/retention approval. Set
   `NOTION_CRM_DELETION_MODE=live` only after the destination and write permissions
   have been verified with a synthetic account in the isolated test database.
   It is separate from `NOTION_CRM_MODE`: stopping ordinary CRM delivery must not
   silently discard account deletion. Missing/disabled cleanup configuration
   leaves the request incomplete for retry/review; it never reports deletion as
   completed. Normal CRM delivery still requires its own fresh dry-run gate.
5. Exercise trial/paid/expired account deletion, preserved CRM fields, no-match,
   lost response, reassigned identity and retry. Record the exact deployed commit,
   instance, destination and aggregate results in DAY-528 before production rollout.

No production activation, Clerk dashboard setup or historical-account deletion
is implied by merging this implementation.

## Local verification

Use an isolated local Convex deployment with a development Clerk issuer. Keep
`pnpm exec convex dev` running in one terminal, then run
`node scripts/check-clerk-lifecycle-local.mjs` in another. The script refuses
cloud deployments/non-loopback HTTP URLs, pins every CLI call to the local or
anonymous deployment in `.env.local`, creates a synthetic local identity, and
checks signed HTTP delivery, signature/instance rejection, stale email protection and deletion access
denial. It generates a local-only signing secret and never prints it. This is a
real backend HTTP smoke test; provider delivery and Notion writes still need the
isolated integration rehearsal described above.

## Historical reconciliation

Set the server-only `CLERK_SECRET_KEY` for the same instance. Every audit/repair
first checks `GET /v1/instance` against `CLERK_WEBHOOK_INSTANCE_ID`. HTTP errors
(including auth failures, throttling and outages) are never interpreted as
account deletion. No cron automatically deletes accounts missing from an audit.

```sh
pnpm exec convex run clerkReconciliation:audit '{"paginationOpts":{"numItems":20,"cursor":null}}'
pnpm exec convex run clerkReconciliation:reconcileAccount '{"clerkId":"user_REVIEWED"}'
```

The audit is read-only and returns counts, opaque IDs needing review, and a
continuation cursor. Repeat with that cursor until `isDone`. The per-account
command also defaults to dry-run. After reviewing the correct instance/account,
an operator can explicitly pass `"dryRun":false` for that single Clerk ID. A
confirmed 404 enters the same deletion pipeline; a present account refreshes the
verified primary email. Append `--prod` only for an explicitly approved production
audit or repair. Do not match or repair accounts by email, and never publish
person-level audit data or secrets in Linear/GitHub.

## Monitoring and recovery

Inspect `accountDeletionRequests` and its controlled stage/error categories.
`deleteNotion` must finish with `crmDeletionVerified=true` before completion
removes the operational identity/page references. Repeated failures reach
`manualReview` after the existing bounded retry schedule. Resolve the underlying
configuration/schema/identity issue, then invoke the internal
`accountDeletion:retryRequest` for that request ID. Never redirect a persisted
cleanup request to another CRM data source. If the request was created without a
destination configured, review and explicitly bind the intended destination
by passing `crmDataSourceId` to `retryRequest`. This can fill an absent destination
only; an existing destination/page binding cannot be redirected. Do not guess it
from email.

On the first processing attempt, requests accepted before this lifecycle layer
get a replay barrier from their stored `ownerTokenIdentifier`, `clerkUserId` and
original `requestedAt`, without changing their accepted policy version. This
repair is transactional and idempotent and runs before provider or data deletion.
Missing identity fields or a conflicting existing Clerk identity go directly to
`manualReview` (`legacy_identity_missing` / `legacy_identity_mismatch`); repair
those only from verified identity evidence. A missing CRM destination likewise
stops processing (`legacy_crm_destination_missing`), even when a source is now
configured. Review the intended retained-contact source, then call
`accountDeletion:retryRequest` with that exact configured `crmDataSourceId`.
The retry cannot bind another source or redirect an existing destination/page.
The resumed worker repairs the barrier before continuing, including for legacy
requests already at `deleteNotion`. Existing manual-review requests remain paused
until this explicit retry. Completed, expired-audit and future-scheduled requests
are not backfilled or reprocessed.

Sources: [Clerk delivery and ordering](https://clerk.com/docs/guides/development/webhooks/overview),
[Svix signature verification](https://docs.svix.com/receiving/verifying-payloads/how),
[Clerk instance verification](https://clerk.com/docs/reference/backend/instance/get).
