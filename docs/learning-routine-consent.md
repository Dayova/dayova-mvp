# Learning routine consent — DAY-475

Follow-up to [DAY-417](https://linear.app/dayova/issue/DAY-417) and PR #651.
Product requirements and remaining acceptance work live in
[DAY-475](https://linear.app/dayova/issue/DAY-475/lernroutine-freiwillig-aufbauen-und-adaptive-lernzeiten-sicher).

## Implemented contract in this draft

- Plan creation does not render a learning-time confirmation or adjustment card.
  Grade-based proposed defaults still support planning; the existing optional
  post-diagnostic reminder is retained.
- Behavior inference uses an explicit reference clock and an owner/start-time
  index. At most 30 recent starts in the preceding 28 days are considered.
  Completed/partially completed, non-provisional, same-day starts count.
  Misses, future starts, and observations preceding the last preference change
  do not establish a routine.
- At least five eligible sessions must span 14 local calendar days. A proposed
  weekday additionally requires three distinct observed dates and a consistent
  direction (75% shifting at least 45 minutes; median shift at least 60 minutes).
  Multiple existing windows on that weekday are ambiguous and not auto-proposed.
- Consent is bound to the current schedule and suggested result. Applying a
  stale, dismissed, or snoozed proposal is rejected on the server.
- Only affected rows are patched. Other weekdays and row IDs survive. Manually
  editing one row no longer confirms unrelated system defaults.
- “Later” suppresses all behavioral proposals for 14 days regardless of their
  fingerprint. Accepting, undoing or manually changing a schedule starts a new
  observation period. Query reference time refreshes when the learning path is
  focused and once per minute while focused.
- Behavioral acceptance now opens a read-only impact sheet. The same scheduling
  calculation powers the preview and atomic application, reserves slots across
  plans and refuses deadline conflicts or stale consent. Started/completed
  sessions are not rescheduled. This covers the existing rolling horizon, **not**
  a guarantee that every future topic will fit before the exam.
- Home coaching is inline and voluntary. Earlier/later opens a time picker and
  an explicit choice: move only today's unstarted committed step, or open regular
  learning-time settings. The one-off mutation preserves content/progress and
  checks ownership, revision, overlaps, date boundaries and next-step ordering.
  Dismissal hides coaching for the day; the global behavioral snooze also applies.
- Local start/forgotten reminders are no longer planned for started, completed,
  partially completed, missed or adjusted sessions. Notification permission and
  preferences remain independent.
- One stored undo record restores the last accepted windows. It is bound to
  row identities, values and revisions and cannot overwrite subsequent edits.
  Undo also restarts observation. Notification preferences are not modified.

## Release gates still open

This draft is not the complete routine-coaching feature and must not be shipped
as if all DAY-475 acceptance criteria were met:

- Combined QA integration, native iPhone/Android tests and compact visual evidence.
- Real-device notification cancellation/delivery and fresh-account first-plan
  upload/AI/knowledge-check acceptance. Mocked tests do not close these gates.

No backend deployment, simulator update, production OTA or real-device
verification is implied by the automated checks. Deploy this schema together
with its backend functions before a matching client build. Do not replace the
combined QA backend with the narrower PR #651 branch.

## Automated evidence

- `convex/learningTimeBehavior.test.ts`: controlled-clock freshness, sample size,
  weekday ambiguity, original-schedule binding, grade bounds and snooze boundary.
- `convex/learningTimes.test.ts`: ownership, unaffected weekdays/IDs, global
  snooze, atomic rollback, completed-session preservation, undo and stale undo.
- `learning-plan-review-times.ui.test.tsx`: renders the actual review screen with
  suggested defaults and verifies that starting remains enabled without a time question.
- `learning-time-suggestion-card.ui.test.tsx`: explicit actions and before/after copy.
- `learningRoutine.test.ts`: voluntary dismissal, owner isolation, one-off
  preservation, stale/started/overlapping rejection and read-only slot reservation.
- `learning-time-impact-sheet.ui.test.tsx`: no automatic acceptance, cancellation,
  revision-bound acceptance and disabled loading/stale/conflicting previews.
- `learning-routine-coach.ui.test.tsx`: voluntary home prompt, one-off consent and
  a separate route for regular preferences.
- `notification-planner.test.ts`: terminal/started learning states do not retain
  future start/forgotten notifications.

These use fixtures and mocked clocks, not multi-week observations on devices.
