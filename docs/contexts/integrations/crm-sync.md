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

Existing pages receive projection writes only after matching. New authenticated
Convex accounts enqueue CRM creation in the same transaction as `syncCurrentUser`.
Repeated sign-ins do not enqueue again, and deploying this feature does not bulk
create contacts for existing accounts. With mode `live`, signup schedules an
immediate reconciliation; the hourly cron recovers pending work when the worker
is busy or unavailable. Signup does not wait for Notion.

The worker processes at most 20 pending signups per run under the same global
lease and request budget as access synchronization. It reuses a unique Clerk-ID
match, otherwise creates a page containing `Student` (name, or `Dayova student`),
`Email`, Clerk ID and the allowlisted profile/access projection. Email is initialized
once; later reconciliation preserves the CRM email. Phone, birth date, specific
school identities, and learner content are not copied.

New pages receive the `Tags` multi-select value `Added through Integration with App`.
It records creation provenance, not onboarding completion. Existing matched pages
are not retroactively tagged: a match does not prove the integration created them.
PATCH requests never include `Tags`, preserving later manual additions/removals.
Creation schema validation requires `Tags` to be a multi-select.

### Student profile projection

The app profile in Convex owns `Student`, `First Name`, `Last Name`, `Grade`,
`State`, and `School Type` for matched users. Every reconciliation refreshes
these fields, including contacts created before this extension. Changes saved
through `syncCurrentUser` (including onboarding) or `updateProfile` schedule
reconciliation in live mode only when a projected value changes. The hourly
sweep repairs failures and changes arriving during an active reconciliation.

- `Student` is the full app name. First/last names use the same convention as
  Clerk registration: first whitespace-delimited part, then all remaining parts.
  This is not an independent structured-name source. A single name clears a
  stale last name; an explicitly empty name clears both and uses `Dayova student`
  as the required title.
- `Grade` is the app's supported grade (6–13); `State` maps the 16 German names
  to the existing CRM codes (for example Bayern → BY, Nordrhein-Westfalen → NW).
- `School Type` is a **select**, using the German labels from the app's bounded
  school-type options. `prefer_not_to_say` clears its selection. Recognized
  generic legacy school types are normalized; specific legacy school names are
  never exported. The existing `School` relation remains manually owned.
- Absent or unsupported source values are omitted, preserving existing CRM
  values for incomplete/legacy accounts. Present supported values overwrite
  manual edits to these app-owned columns on the next sync.

Both the test and production Students schemas need the exact property names
and types in `CRM_PROFILE_PROPERTIES`. This extension does not create CRM rows
for older accounts that have no existing match or pending signup.

An email collision (case-insensitive, including CRM rows without a Clerk ID),
duplicate identity or missing previously linked page goes to operator review,
without creating or automatically merging a contact. Email is only a duplicate
veto, never a durable join key. Legacy email matching is inspected in dry-run
mode for **exact, case-sensitive
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

### Payment status and subscription plan

For matched app accounts, the integration owns `Payment Status` and `Subscription
Plan` on creation and on every subsequent reconciliation. Manual values in these
two columns, including `want to pay`, are replaced by verified app state. Keep
sales intent in CRM-owned notes/tags instead. Unmatched contacts are untouched.

| Evidence | Payment Status | Subscription Plan |
| --- | --- | --- |
| No activated access | None | None |
| Active Dayova account trial | Trial | None |
| Active verified store trial (`period_type=trial`) | Trial | Mapped plan |
| Active verified normal/introductory paid period | Paid | Mapped plan |
| Active verified subscription with a billing issue, with or without grace | Overdue | Mapped plan |
| Expired or revoked access without a valid fallback trial | Expired | None |
| Active subscription with missing/unsupported period metadata | Unknown | Mapped plan |

Turning renewal off does not end the paid period; it remains `Paid` until access
expires. `Cancelled` is not inferred from expiry (which can also mean an expired
trial or revocation). `Overdue` means RevenueCat reports a billing issue, not a
claim about an outstanding invoice. A valid Dayova trial can still be the
effective access after a subscription is revoked; that projects `Trial / None`.

`crmBilling.ts` maps exact store/product identifiers verified in the
[Dayova RevenueCat catalog](https://app.revenuecat.com/projects/413fab77/product-catalog/products)
on 2026-09-21:

| Store | Product identifier | Plan |
| --- | --- | --- |
| app_store | com.dayova.abonnement.monthly | Monthly |
| app_store | com.dayova.abonnemment.yearly | Annual |
| play_store | dayova_monthly:monthly-autorenewing (or dedicated subscription ID dayova_monthly) | Monthly |
| play_store | dayova_annual:annual-autorenewing (or dedicated subscription ID dayova_annual) | Annual |

Unknown active products map to `Unknown`, never to an inferred cadence or `None`.
Update the mapping when adding/changing store products or base-plan cadences.
The existing native-store access policy is unchanged: web billing, promotional
grants and RevenueCat Test Store purchases are not promoted into native paid
access by this CRM extension. Quarterly and School License are not inferred.

The server now retains RevenueCat's optional `period_type` in
`subscriptionPeriodType`. Existing snapshots without it show `Unknown` payment
status until the next verified subscriber refresh; CRM reconciliation does not
fetch RevenueCat itself. Store trial access remains unchanged in the app.
See [RevenueCat Customer Info model](https://www.revenuecat.com/docs/api-v1/customer-info-model).

Trial activation and changed verified subscription snapshots schedule an immediate
reconciliation in live mode. Identical subscription snapshots do not schedule
extra work just because their verification timestamp changes. The hourly sweep
repairs failed/busy runs and handles expiry without an incoming event.

Manually owned `Status`, tags after creation, email/phone, notes, research and
relationship fields remain separate. `Entitlement State` remains the effective
app-access projection, distinct from payment-period evidence. No tokens, receipts,
payment IDs, management URLs or raw provider payloads are projected.

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
   source, with read, update and insert capabilities. Store its token in Convex's server
   environment as `NOTION_CRM_TOKEN`, never an Expo env, code, issue or chat.
2. Set `NOTION_CRM_DATA_SOURCE_ID` for that deployment and keep `NOTION_CRM_MODE`
   at `off`. Development must use a separate test database/token for live tests;
   do not point development live sync at the production CRM.
3. Add missing projection properties with the exact types in `CRM_PROPERTIES`.
   Identity Status options: unmatched, proposed, matched, conflict. Entitlement
   State: none, trial, paid, billing grace, expired. Sync Error options use the
   categories in `crmContract.ts`. Payment Status also needs `None` and `Expired`;
   Subscription Plan needs `Unknown`; Tags needs `Added through Integration with App`.
   Preserve all existing options when extending the schema.
   Dry-run only requires the existing Clerk ID
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

`crmStudentSignups` stores a user ID and pending/review state, without copying
contact data into the queue. Pending work is bounded to 20 entries per run;
inspect its `by_status` index for backlog/review work. Aggregate reports include
`created`, `wouldCreate` and `creationReview` when a signup batch is inspected.
These are batch counts, not total backlog counts. `total` remains the inventory
size before creation. Dry-run never creates pages or consumes queued signups.

Before `POST /pages`, persist the attempt and destination. Unlike deterministic
PATCH requests, creates are never retried blindly, including on network errors,
429/5xx responses or worker crashes. The next run searches for the Clerk ID and
recovers a successful create whose response was lost. If no unique page is found,
the queue entry moves to review; absence from search does not prove creation
failed. Resolve the page/identity in Notion, then set the entry back to pending
to reuse the reviewed Clerk match. Only clear an attempt marker after explicitly
verifying in Notion that no page was created; this permits a new create request.
Do not reset the destination marker to redirect an uncertain create.

Account deletion removes queued signups as well as mappings. The worker checks
that the user and queue entry still exist immediately before creation. A deletion
or external CRM edit racing an in-flight Notion request cannot be rolled back
across systems; resolve any orphaned contact through the CRM deletion process.

`crmSyncState:status` is internal/admin-only. Inspect counts, error, running,
startedAt, finishedAt and lastSuccessAt. Alert via the deployment's existing
operations monitoring on a failed cron, nonzero failed/conflict/creationReview counts, or a live
lastSuccessAt older than two hours. If running exceeds eleven minutes, the worker
timed out; the next run can reclaim the lease. Warnings contain only aggregate
counts/categories. Missing runtime configuration returns `configuration`; it must
not be interpreted as a successful sync. Unmatched/proposed rows need CRM review.

For authorization/schema errors, fix integration access or property types and
rerun. Retryable reads/PATCH requests respect Retry-After; a failed create needs
the attempt-recovery procedure above. For mapping conflicts, pause live mode,
review Clerk ID and page ownership, correct the reviewed Notion record or remove
only the obsolete mapping via the Convex dashboard, then dry-run before resuming.
Never fix a CRM mismatch by changing app entitlements. Set mode `off` to pause
future runs; an already running action may finish its current sweep.

Per-user operational storage is one link row with opaque IDs, last attempt,
last success and a controlled error, plus one pending/review signup row until
delivery completes. The existing account-deletion flow removes both kinds of
rows. Global status stores only the latest aggregate run and success
timestamps, not an unbounded audit history. The integration does not recreate
deleted users or silently bind a re-registration by email. Unmatched CRM rows
retain their previous projection/timestamp and require review; they must not be
treated as current access. Notion/Loops retention and deletion must follow the
approved DAY-357/DAY-358 processor policy before live rollout; deleting the app
account alone is not proof the independent CRM contact was deleted.

API references: [query data source](https://developers.notion.com/reference/query-a-data-source),
[create page](https://developers.notion.com/reference/post-page),
[update page](https://developers.notion.com/reference/patch-page),
[request limits](https://developers.notion.com/reference/request-limits).
