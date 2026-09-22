# Automatic student contacts in Loops (DAY-427)

Execution: [DAY-427](https://linear.app/dayova/issue/DAY-427).
Existing-account import: [DAY-467](https://linear.app/dayova/issue/DAY-467), Julius.
Built on the [DAY-366 CRM integration](https://github.com/Dayova/dayova-mvp/pull/695).

## Contract

`users.syncCurrentUser` inserts a `loopsStudents` delivery record in the same
transaction as a new app account. Repeated login does not duplicate it. Older
accounts with no delivery record are never enrolled implicitly. Queueing works
with `LOOPS_MODE=off`; enablement delivers these pending new accounts. Notion
availability and `NOTION_CRM_MODE` do not affect Loops delivery.

Loops receives the authenticated Clerk ID as `userId`, authenticated account
email, and the app name split using the existing Clerk convention. Creation also
sets `source=Dayova App`, `userGroup=students`, and membership of the configured
student list. Later name changes update that same contact. Arbitrary
`updateProfile.email` input is never used as the recipient. School information,
phone, birth date, learning content, tokens and billing payloads are not sent.
Founder-marked accounts are excluded at delivery. Other internal/test accounts
must use the development deployment and test list; the app has no general
student-versus-staff role classifier.

This slice does not send events or transactional emails, change campaigns,
derive billing state, or export CRM-only contacts. Trial lifecycle synchronization
and campaign entry/exit remain DAY-427 follow-up work. Existing Loops contact/list
triggers can nevertheless run on creation: inspect them before enabling live mode.

## Identity and unsubscribe behavior

- Look up Clerk ID and email separately before writing. Email-only existing
  contacts and conflicting identities require operator review; never bind by
  email alone. No contact is silently merged or reassigned.
- Creation uses `POST /contacts/create`, rather than the update endpoint's
  implicit upsert. Record the create attempt before the request. A lost response
  is recovered by Clerk ID; if the contact is still absent, stop for review rather
  than blindly create again. The next five-minute sweep retries recoverable reads.
- Membership is assigned **only on first creation**. Updates include only userId
  and name fields, never `subscribed`, `mailingLists` or email. Global unsubscribe
  remains untouched. A missing list membership is ambiguous (never enrolled or
  unsubscribed) and goes to review without re-enrollment.
- Loops subscribes new API contacts by default. The production operator must
  verify the intended audience/permission and existing creation triggers before
  activation; signup is not recorded as a separate marketing-consent event.
- Authenticated email changes are surfaced as `email_changed`. Resolve the
  email/identity in Loops before retrying; this version never overwrites a remote
  recipient automatically. A missing/replaced mapped contact requires review.

## Configuration and rollout

Server-only Convex variables:

| Variable | Value |
| --- | --- |
| `LOOPS_API_KEY` | API key stored only in the intended Convex deployment |
| `LOOPS_STUDENT_LIST_ID` | Production: `cmucp5ftscjij0jyh2p78ed9y`; separate test list in development |
| `LOOPS_MODE` | `off` (also the default) or `live` |

1. Deploy with mode off. Confirm the deployment and Loops destination. Live mode
   fails closed without an API key or an existing list matching the configured ID.
2. In development, use an isolated list and synthetic `@example.com` contact.
   Exercise signup, repeat login, name change, unsubscribe and deletion.
3. Run `pnpm exec convex run loopsSync:reconcile '{"dryRun":true}'`.
   This inspects up to 20 due delivery records and checks provider identities,
   but performs no Loops writes and does not consume or bind pending records.
   Only aggregate worker status is persisted. Review-state records are inspected
   in the Convex dashboard, not included in the due pending batch.
4. Verify campaign/list triggers and the production audience, then configure the
   production list and `LOOPS_MODE=live` in the intended deployment. Production
   CLI commands must explicitly select `--prod`. This runbook is not evidence of
   production deployment or activation.
5. Inspect `loopsState:status` and a synthetic contact's readback. Confirm ordinary
   app signup never waits on the external API. Keep the parent CRM PR dependency
   intact until it is merged.

## Recovery and deletion

The worker serializes calls at at most four requests/second, processes up to 20
due records and stops beginning new records after three minutes. Each HTTP
request has a 15-second timeout. An eleven-minute lease exceeds the Convex action
lifetime so a crashed worker cannot overlap its successor. The five-minute cron
recovers work skipped by a busy worker and drains larger batches over time.

429 honors Retry-After for the whole worker and the affected record. Network/5xx
failures back off, up to one hour per record; configuration, malformed responses,
identity conflicts and deterministic rejection are visible for correction.
No provider response body, address, key or name is included in diagnostics.
Concurrent name changes stay pending after an older request finishes.

`loopsState:status` is internal/admin-only and exposes bounded pending/review
counts (101 means capped when `countsCapped=true`), worker lease and error state.
Inspect affected `loopsStudents` rows in the restricted Convex dashboard.
Alert through existing operations monitoring on `review > 0`, worker errors or
pending work surviving several cron intervals. `loopsState:retry {id}` retries
after operator correction; it does not clear the create-attempt or destination
markers. Never clear these without confirming the original remote outcome.

Account deletion immediately cancels unsent work. Once a remote attempt has
started, keep a tombstone with opaque identity/contact IDs, remove the stored
email, and delete the matching Loops contact asynchronously. Delete by Clerk ID
only after checking the saved contact mapping. Remove the tombstone after remote
confirmation. A creation racing deletion remains pending for cleanup; uncertain
unobserved creates stay in review. Turning Loops off also pauses these deletes,
so monitor retained tombstones and resolve them before claiming processor erasure.
The tombstone's `userId` can intentionally refer to an already deleted user.

List destinations are pinned before the first write; a changed list requires
operator review. Loops does not offer a cross-system transaction: independent
manual identity changes during an in-flight request still require reconciliation.

References: [create](https://loops.so/docs/api-reference/create-contact),
[update](https://loops.so/docs/api-reference/update-contact),
[find](https://loops.so/docs/api-reference/find-contact),
[lists](https://loops.so/docs/contacts/mailing-lists).
