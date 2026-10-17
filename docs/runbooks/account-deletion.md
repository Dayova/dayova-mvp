# Account deletion runbook

This runbook covers the server-authoritative deletion pipeline introduced for
DAY-358. The retention policy identifier is currently
`DAY-357-draft-2026-09-18`; production enablement remains gated on the
accountable-human approval tracked in DAY-357.

## Required Convex environment

- `CLERK_SECRET_KEY`: required. Revokes every active Clerk session and deletes
  the Clerk identity.
- `REVENUECAT_SECRET_API_KEY`: optional only when RevenueCat is not configured
  for the environment. Deleting the RevenueCat customer does not cancel an
  App Store or Play Store subscription.
- `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID`: configure both or neither.
  The key must be allowed to delete persons. Events and recordings are included.
- `POSTHOG_API_HOST`: optional, defaults to `https://eu.posthog.com`.
- `NOTION_CRM_DELETION_MODE=live`, `NOTION_CRM_TOKEN` and
  `NOTION_CRM_DATA_SOURCE_ID`: required for verified CRM account cleanup.
  This switch is independent of normal `NOTION_CRM_MODE` delivery.

Set secrets with `npx convex env set NAME value`; never add them to Expo public
environment variables.

## Pipeline and guarantees

1. The client verifies the current password with Clerk and obtains a fresh JWT.
   `POST /account-deletion` independently verifies that password with Clerk for
   the authenticated subject before accepting the request. Passwords are not
   persisted or forwarded as mutation arguments. The legacy public mutation
   fails closed.
2. Convex creates one idempotent `accountDeletionRequests` tombstone and denies
   subsequent app reads and writes for that owner immediately.
3. The processor revokes all active Clerk sessions, deletes the Clerk identity,
   removes the RevenueCat customer, and deletes the PostHog person together with
   events and recordings.
4. Convex-owned rows and uploaded files are deleted in bounded batches.
5. The `deleteNotion` stage retains the CRM contact and manual/profile/history
   fields, clears current app identity/access fields and marks the app account
   deleted. Completion requires `crmDeletionVerified=true` after readback.
6. Completion removes owner and Clerk identifiers from the request. Only the
   request id, policy version, timestamps, processor outcomes, counts, and a
   machine-readable error code remain as the minimum operational audit record.

The pipeline also removes the user's local CRM signup, link and update rows.
The retained Notion contact follows Jakob's explicit CRM decision documented in
[the Clerk lifecycle runbook](clerk-lifecycle.md). It does not delete an
independent Loops contact. A completed app-account request therefore does not
certify erasure from every independent processor.

Each completed stage is durable and safe to repeat. HTTP 404 responses are
treated as successful deletion. Failures use capped exponential delays and move
to `manualReview` after eight failed attempts. Logs contain request id, stage,
attempt number, and sanitized error code only.

## Operations

- Search `accountDeletionRequests` by `requestId` in the Convex dashboard.
- `retryScheduled` means the scheduler will continue automatically.
- `manualReview` means an operator must fix the configuration or provider
  problem, then run `accountDeletion.retryRequest` with the request id from the
  Convex dashboard. This resets attempts, re-queues the request and resumes its
  stored stage. Calling the processor directly does not unblock manual review.
- Disabled or missing Notion cleanup configuration retries at `deleteNotion`
  and eventually reaches `manualReview`; it never reports successful completion.
- A completed record must have `stage=complete`, no owner or Clerk id, and
  processor status fields for every configured downstream system.

Do not claim that deleting the account cancels a store subscription. The app's
confirmation copy tells the user to cancel an active store subscription in the
relevant store separately.

## Production gate

Before enabling this pipeline in production, DAY-357 must approve the final
retention/deletion matrix and its version. Replace the draft policy identifier,
implement the approved expiry of completed operational audit records and the
approved Notion/Loops contact handling,
verify every production secret, execute a sandbox deletion for Clerk,
RevenueCat, PostHog, and any enabled CRM processor, and attach evidence to
DAY-358.
