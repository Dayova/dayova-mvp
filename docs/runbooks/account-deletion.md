# Account deletion runbook

This runbook covers the server-authoritative deletion pipeline introduced for
DAY-358. Jakob approved the
[DAY-357 decision record](https://app.notion.com/p/3c82e87228bf81e1b3efe45d3e8e7d07)
on 18 October 2026. New requests use `DAY-357-approved-2026-10-18`;
existing requests retain the version under which they were accepted.
Completed operational audits expire automatically after 30 days. Queued,
processing, retrying and manual-review requests retain their sanitized error
codes and recovery context until resolved; only successful completion starts
the retention clock. Detailed investigation of completed requests has a 30-day
window. This does not retain learner content for debugging.
The dependent lifecycle layer expires its minimal replay barriers after 90 days
and rejects older lifecycle events independently of those barriers.

## Required Convex environment

- `CLERK_SECRET_KEY`: required. Verifies the current password for the authenticated
  subject, revokes active Clerk sessions and deletes the Clerk identity.
- `REVENUECAT_SECRET_API_KEY`: optional only when RevenueCat is not configured
  for the environment. Deleting the RevenueCat customer does not cancel an
  App Store or Play Store subscription.
- `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID`: configure both or neither.
  The key must be allowed to delete persons. Events and recordings are included.
- `POSTHOG_API_HOST`: optional, defaults to `https://eu.posthog.com`.

Set secrets with `npx convex env set NAME value`; never add them to Expo public
environment variables.

## Pipeline and guarantees

1. The client completes Clerk first-factor reverification and posts the current
   password with a fresh Convex token to `/account-deletion`. The HTTP endpoint
   independently verifies the password with Clerk `verify_password` for the
   authenticated subject before calling internal `enqueueVerifiedDeletion`.
   Passwords are never persisted or passed to mutations. The legacy public
   mutation fails closed because Convex omits `fva` from `UserIdentity`.
2. Convex creates one idempotent `accountDeletionRequests` tombstone and denies
   subsequent app reads and writes for that owner immediately.
3. The processor revokes all active Clerk sessions, deletes the Clerk identity,
   removes the RevenueCat customer, and deletes the PostHog person together with
   events and recordings.
4. Convex-owned rows and uploaded files are deleted in bounded batches.
5. Completion removes owner and Clerk identifiers from the request. Only the
   request id, policy version, timestamps, processor outcomes, counts, and a
   machine-readable error code remain as the minimum operational audit record.

The current pipeline also removes the user's local CRM signup, link, and update
rows. It does **not** delete or anonymize the corresponding contact in Notion
or Loops. A completed app-account request is therefore not evidence that those
independent processor records were deleted. Keep the CRM integration disabled
for live use until DAY-357 defines their treatment and DAY-358 implements and
tests the approved behavior.

Each completed stage is durable and safe to repeat. HTTP 404 responses are
treated as successful deletion. Failures use capped exponential delays and move
to `manualReview` after eight failed attempts. Logs contain request id, stage,
attempt number, and sanitized error code only.
A competing worker that loses the stage transition stops without scheduling
another chain. Repeating a verified request or an operator invocation can still
restart processing at the stored stage.

## Operations

- Search `accountDeletionRequests` by `requestId` in the Convex dashboard.
- `retryScheduled` means the scheduler will continue automatically.
- `manualReview` means an operator must fix the configuration or provider
  problem, then run `accountDeletionActions.processDeletionRequest` with the
  request id from the Convex dashboard. The action resumes at the stored stage.
- A completed record must have `stage=complete`, no owner or Clerk id, and
  processor status fields for every configured downstream system.

Do not claim that deleting the account cancels a store subscription. The app's
confirmation copy tells the user to cancel an active store subscription in the
relevant store separately.

## Production gate

Before enabling this pipeline in production, include the dependent lifecycle
layer's approved Notion contact handling and 90-day replay safeguards,
verify every production secret, execute a sandbox deletion for Clerk,
RevenueCat, PostHog, and any enabled CRM processor, and attach evidence to
DAY-358.
