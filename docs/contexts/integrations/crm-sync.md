# Student CRM projection (DAY-366)

Execution: [DAY-366](https://linear.app/dayova/issue/DAY-366).
Destination: [Students](https://app.notion.com/p/cf81d5caf5944c349b76cfa532c94d5c),
data source `d6268034-4ccc-4158-b82f-8f32d97bf401`.

## Contract

`RevenueCat -> Convex effective access -> Notion`. `crmSyncState` reuses
`getCurrentAccess`; it never calls PostHog or interprets a CRM payment label as
access. Clerk `user.id`, Convex `users.clerkId`, RevenueCat `app_user_id`, and
PostHog `distinct_id` share the same identity. Notion's existing `Clerk User ID`
is the single provider correlation field; duplicating it under other names is
unnecessary. The integration also stores `Convex User ID` and a one-to-one
`crmStudentLinks` mapping to the Notion page ID. Subsequent remapping requires
operator review; changing Notion's ID cannot silently reassign an existing link.

Only already matched existing pages receive projection writes. No contacts are
created. Email is inspected only in dry-run mode for **exact, case-sensitive
one-time proposals**. An operator verifies proposed matches in a restricted
surface and explicitly fills Clerk User ID in Notion before rerunning the
dry run. Names are never a matching key. Duplicate Clerk IDs on either side,
missing users, duplicate entitlement rows and mismatched stored links are skipped.

Projection fields are defined in `convex/crmNotion.ts:CRM_PROPERTIES`. They
include identity status, effective entitlement state, product/store, subscription
and grace expiry, trial dates, renewal, last sync, source and controlled error.
No entitlement row means `none`; a revoked/refunded subscription falls back to
any still-valid Dayova trial, exactly as app access does. Otherwise it expires.
An active flag without `subscriptionVerifiedAt` is a conflict, never verified
paid evidence. The integration reflects the last verified Convex snapshot; it
does not repair upstream RevenueCat webhook delivery or promise real-time billing.

Manually owned `Status`, `Payment Status`, `Subscription Plan`, contacts, notes,
research and relationship fields remain separate. `Entitlement State` is the
authoritative projection for follow-up decisions. No tokens, receipts, payment
IDs, management URLs or raw provider payloads are projected.

## Runtime and limits

An hourly cron runs `crmSync:reconcile`. Modes default to `off`; dry-run performs
no Notion writes and creates no user mappings, but persists aggregate operational
status in Convex. Live reads fresh Notion identity/uniqueness and Convex state
before each PATCH. Notion has no transaction spanning these systems: concurrent
identity edits or billing changes can race a request. Avoid editing identity
fields during a run. Later reconciliation repairs state drift; the CRM never
controls app access.

Notion requests use API version `2025-09-03`, at most 2.5 requests/second, a
15-second request timeout and four attempts for network errors, HTTP 429 and
5xx, honoring Retry-After. Retries reuse the exact PATCH payload. Deterministic
field updates are idempotent; successful reconciliation advances Last Synced At.
Null source fields clear stale CRM values. Terminal failures stop the run, retain
aggregate partial counts and a controlled category, and retry on the next hour.
Identity conflicts skip only the affected row.

The initial cohort implementation loads a paginated inventory of at most **200
CRM rows** before any writes. Overflow fails closed with `capacity`, never a
truncated successful report. The paid-user audit paginates at 100 users per query
with a 20,000-user cap. Requests have an eight-minute budget; a single-run lease
lasts eleven minutes (longer than Convex's ten-minute action lifetime). Before
expanding beyond these limits, replace the bounded cohort sweep with a durable
batched workflow. Never just remove the limits.

## Setup and rollout

Technical owner: Jakob. CRM matching/review: Julius with Jakob.

1. Use a Notion internal integration shared only with the required Students data
   source, with read and update capabilities. Store its token in Convex's server
   environment as `NOTION_CRM_TOKEN`, never an Expo env, code, issue or chat.
2. Set `NOTION_CRM_DATA_SOURCE_ID` for that deployment and keep `NOTION_CRM_MODE`
   at `off`. Development must use a separate test database/token for live tests;
   do not point development live sync at the production CRM.
3. Add missing projection properties with the exact types in `CRM_PROPERTIES`.
   Identity Status options: unmatched, proposed, matched, conflict. Entitlement
   State: none, trial, paid, billing grace, expired. Sync Error options use the
   categories in `crmContract.ts`. Dry-run only requires the existing Clerk ID
   property, so it can precede the schema extension.
4. Deploy and test in development. Run a dry run using the Convex dashboard, or:

   ```sh
   pnpm exec convex run crmSync:reconcile '{"dryRun":true}'
   pnpm exec convex run crmSyncState:status '{}'
   ```

   The result contains total, matched, unmatched, proposed, conflict,
   paidWithoutEntitlement, paidWithoutCrm, synced and failed counts. Proposed is
   separate from unmatched. `paidWithoutEntitlement` means a CRM Paid label lacks
   a **confirmed matched paid/grace entitlement**, including unresolved identities;
   it is a review count, not proof a person has not paid. Missing CRM counts include
   paid users whose mapping is ambiguous. No person-level data belongs in Linear.
5. Review the aggregate report and resolve proposed/duplicate mappings in Notion.
   Verify a synthetic account through trial, paid, grace, expired and revoked
   transitions in a test database. The default `off` mode allows an explicit dry run.
6. Once the intended deployment and destination are verified, set mode to `live`.
   First enablement requires a successful dry run for the same data source within
   24 hours. Successful live runs keep the recurring sync enabled. A destination
   change requires a new dry run. Run reconciliation manually once, inspect the
   destination and record the deployment, aggregate counts and timestamp in DAY-366.

For production commands, explicitly select `--prod`; this runbook is not a claim
that production rollout or the real-account backfill has already happened.

## Monitoring, recovery and deletion

`crmSyncState:status` is internal/admin-only. Inspect counts, error, running,
startedAt, finishedAt and lastSuccessAt. Alert via the deployment's existing
operations monitoring on a failed cron, nonzero failed/conflict counts, or a live
lastSuccessAt older than two hours. If running exceeds eleven minutes, the worker
timed out; the next run can reclaim the lease. Warnings contain only aggregate
counts/categories. Missing runtime configuration returns `configuration`; it must
not be interpreted as a successful sync. Unmatched/proposed rows need CRM review.

For authorization/schema errors, fix integration access or property types and
rerun. Rate limits respect Retry-After. For mapping conflicts, pause live mode,
review Clerk ID and page ownership, correct the reviewed Notion record or remove
only the obsolete mapping via the Convex dashboard, then dry-run before resuming.
Never fix a CRM mismatch by changing app entitlements. Set mode `off` to pause
future runs; an already running action may finish its current sweep.

Per-user operational storage is one link row with opaque IDs, last attempt,
last success and a controlled error. The existing account-deletion flow removes
these link rows. Global status stores only the latest aggregate run and success
timestamps, not an unbounded audit history. The integration does not recreate
deleted users or silently bind a re-registration by email. Unmatched CRM rows
retain their previous projection/timestamp and require review; they must not be
treated as current access. Notion/Loops retention and deletion must follow the
approved DAY-357/DAY-358 processor policy before live rollout; deleting the app
account alone is not proof the independent CRM contact was deleted.

API references: [query data source](https://developers.notion.com/reference/query-a-data-source),
[update page](https://developers.notion.com/reference/patch-page),
[request limits](https://developers.notion.com/reference/request-limits).
