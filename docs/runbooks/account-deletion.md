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

Set secrets with `npx convex env set NAME value`; never add them to Expo public
environment variables.

## Pipeline and guarantees

1. The client asks Clerk for recent first-factor reverification when the token's
   factor verification age is older than ten minutes.
2. Convex creates one idempotent `accountDeletionRequests` tombstone and denies
   subsequent app reads and writes for that owner immediately.
3. The processor revokes all active Clerk sessions, deletes the Clerk identity,
   removes the RevenueCat customer, and deletes the PostHog person together with
   events and recordings.
4. Convex-owned rows and uploaded files are deleted in bounded batches.
5. Completion removes owner and Clerk identifiers from the request. Only the
   request id, policy version, timestamps, processor outcomes, counts, and a
   machine-readable error code remain as the minimum operational audit record.

Each completed stage is durable and safe to repeat. HTTP 404 responses are
treated as successful deletion. Failures use capped exponential delays and move
to `manualReview` after eight failed attempts. Logs contain request id, stage,
attempt number, and sanitized error code only.

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

Before enabling this pipeline in production, DAY-357 must approve the final
retention/deletion matrix and its version. Replace the draft policy identifier,
verify every production secret, execute a sandbox deletion for Clerk,
RevenueCat, and PostHog, and attach evidence to DAY-358.
