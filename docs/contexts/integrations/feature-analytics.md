# Feature analytics contract (DAY-435)

Product hypotheses and their decision rules live in the [Notion measurement
map](https://app.notion.com/p/3de2e87228bf81f5a853fd9605a9c7bc). This document owns
only the code-facing measurement contract. The implementation issue is
[DAY-435](https://linear.app/dayova/issue/DAY-435).

## Event boundary

`src/lib/analytics.ts` remains the only capture/projection boundary. The two new
additive schema-1 events are:

- `app_screen_viewed`: bounded `screen`, once on a supported route becoming
  observable while active, on navigation to another route instance, and after a
  background → active transition. Ordinary rerenders and repeated active
  callbacks are suppressed. The raw pathname is used only for local deduplication
  and never sent; route templates select the approved screen name.
- `feature_interaction`: bounded `interaction`, `outcome`, optional opaque
  `entity_id`, bounded `value`, and bounded current `screen`. `value` identifies
  entry steps, billing cadence or notification controls, never their free text.
  The authoritative identifiers are listed in `src/lib/feature-analytics.ts`.

`FeatureAnalyticsProvider` requires a loaded Clerk user, authenticated Convex
session, and configured PostHog. EAS channel, runtime, update/embedded-launch
context and validation student code are added when available. The existing
platform restriction disables iOS even with a key (PR #537). Do not interpret
this dataset as all app users. Restoration of iOS is pending a separate decision.

The provider rejects callbacks retained from a previous account. It does not
write backend activity on every tap: screen exposure must not redefine the
existing meaningful-activity/next-day-return contract. PostHog transport failures
are isolated from product actions and reported without raw error payloads.

No anonymous tracking, autocapture, keystroke/scroll logging, session replay,
content, raw routes, query parameters, filenames, answers, financial receipts or
free-form errors are added. Existing person-property restrictions remain.

## Counting rules

| Outcome | Meaning |
| --- | --- |
| `performed` | Local semantic action, such as selecting a day or revealing an analysis answer |
| `attempted` | An instrumented asynchronous action was submitted |
| `succeeded` | The corresponding awaited operation returned successfully |
| `failed` | The instrumented operation rejected or did not find an entitlement |
| `cancelled` | The store purchase sheet returned cancellation |
| `pending` | The store action returned, but refreshed app access is not yet confirmed |

Not every action has an attempt event. Do not calculate a universal success
rate by dividing all successes by all attempts. Use an action with paired hooks.
Timetable lesson additions/removals are draft operations; meaningful persisted
use is `timetable.save`/`succeeded`. `exam.update` distinguishes editing a saved
exam from creating another one. Homework completions are restricted to actual
`Hausaufgabe` entries; other entries use `entry.complete`/`entry.reopen`.

`learning_plan.content_viewed` observes a focused plan screen with at least one
session, once per focus (or changed plan/auth context). It is not a psychological
Aha, not a first-ever milestone, and does not assert recognized personalization.
The current first-session Wissenscheck flow differs from older pre-plan research
language; DAY-351/DAY-352 own that accepted contract.

These are best-effort client observations, not an exactly-once ledger. Navigation
away/back or process restart may legitimately produce another exposure. Repeated
successful actions may occur; use distinct users and entity IDs for adoption.
Process death/offline queue loss may leave unmatched attempts. No historical
backfill is implied. Existing validation events keep their original semantics.

Client subscription/trial actions measure the UI flow. A checkout `succeeded`
means refreshed access was active; it is not authoritative revenue or proof of a
new charge. Verified lifecycle/renewal/refund accounting remains DAY-300. The
attempt-level AI-cost ledger and reconciliation remain DAY-258. This change does
not close either issue or the DAY-319 ingestion-smoke task.

## Reports and rollout verification

[Production dashboard](https://eu.posthog.com/project/190091/dashboard/818617)
now defaults to 30 days. Its existing three overviews cover eight observed
validation events; existing funnels and retention are preserved. Four new saved
reports provide coverage, screen reach, action outcomes and repeat-use counts.
Their tested definitions are in `feature-insights.json`.

New reports deliberately require `eas_channel = production`, exclude
`analytics-smoke-*` identities, and use a fixed rolling 30-day window. Unlike
product-analytics reports, these SQL reports do not automatically apply the
project's test-account filters. Exclude the team's approved internal-account
cohort before making decisions; missing channel metadata is excluded. Until a
new release is verified, coverage returns `AWAITING_INSTRUMENTED_RELEASE`, not
zero feature adoption. Missing rows never prove disuse.

For each enabled platform and release:

1. Use a known test identity in the separate Development PostHog project
   (190100), never production learner data. Confirm the configured project and
   build channel before acting. DAY-319 owns automating this check.
2. Sign out and navigate: no new custom events. Sign in: one supported-screen
   observation, no duplicates from rerenders. Background/foreground: one new
   exposure. Navigate between two session IDs: two observations with only the
   same safe screen name, no raw IDs in the screen field.
3. Create then revisit/update an exam; create/complete/reopen homework; save a
   timetable and learning availability; open a populated plan; answer a question;
   reveal analysis; change one notification setting. Check the named actions,
   outcomes and opaque entity links against durable state.
4. Force a failed action and cancel a store sheet. Neither must become a success.
   Switch accounts during an in-flight action: its old callback must not identify
   the new account. Verify no raw content appears in received properties.
5. Check PostHog receipt and queryability, not just an HTTP success or a unit
   test. Record app version, EAS update/channel, platform, identity exclusion,
   expected/observed event counts and timestamps. Do not mark production
   ingestion complete before a deployed build passes the same checks.

For removal decisions, use the linked Notion rules: coverage first, then exposed
and successful users, repeat use over a mature window, and workflow-dependency
interviews. This implementation does not validate a hypothesis or remove a
feature.
