# Native notification timestamp reconciliation

Related: DAY-475. Isolated frontend fix on main; no backend validation is relaxed.

## Cause and regression

The installed Expo Notifications iOS `NotificationRecord` serializes
`notification.date.timeIntervalSince1970` (seconds), while Android's serializer
uses `Date.getTime()` (milliseconds). The JS `mapNotification` passes the date
through unchanged. Dayova previously constructed `new Date(date)` on both.

The failing regression converts the observed iOS delivery timestamp
`1790422020.229497` to `1970-01-21T17:20:22.020Z` instead of
`2026-09-26T11:27:00.229Z`. The corrected platform boundary explicitly supplies
seconds on iOS and milliseconds on Android. Owner checks and server expiry/
early-delivery checks remain unchanged.

## Verification

- Regression failed before the fix, then all nine timestamp tests passed.
- Timestamp and backend notification suites: 24 tests passed.
- Full isolated-main Vitest run: 902 tests in 126 files passed.
- TypeScript and targeted ESLint passed.
- Combined native QA source: `e601a45e`, based on #761 `035fb16b` plus isolated
  fix `20a206f1`. Both iOS 26.4 and Android API 36 connected to Metro 8093.
- QA backend `dev:trustworthy-skunk-257` logged failed
  `notifications:recordDeliveredNotification` calls at 13:30–13:35 CEST before
  the fix. After reopening the clients, the same function succeeded four times
  at 13:52:43–13:52:49 (11–12ms). No new backend deployment was performed.
- The previously delivered synthetic reminder remained a single history entry;
  no test data or learner progress was deleted/reset. The existing entry was
  created before the fix, so its existence alone is not used as proof.

This is reconciliation of already delivered native reminders, not a new
notification-delivery or locked-screen test. Prior actual OS-delivery evidence:
[PR #761 delivery report](https://github.com/Dayova/dayova-mvp/blob/035fb16b/docs/qa/routine-handoff-2026-09-26/delivery.md).

No production deployment, merge or blanket acceptance of other PRs is claimed.
