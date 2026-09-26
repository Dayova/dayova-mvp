# Learning routine: generated date-key compatibility

During the native iPhone PDF replay, newly generated sessions used ISO-midnight
date keys. Home coaching and the one-off rescheduling mutation compared these
with date-only keys, so real generated sessions could be omitted or rejected.

This fix reuses the calendar's bounded date-key variants and Berlin-day
normalization. It does not migrate records or reset learning progress. Ownership,
execution-state, optimistic concurrency and next-session ordering checks remain.

## Validation

- Before the fix, two regression cases failed for UTC-midnight and Berlin-midnight
  ISO representations.
- After the fix: 1,117 tests across 155 Vitest files passed.
- TypeScript and targeted ESLint passed.
- Regression assertions preserve the complete session except its start time and
  update timestamp, update the calendar time, leave regular learning times alone,
  and reject crossing an ISO-dated provisional next step.

## Acceptance boundary

These are automated backend results, not a claim of completed native acceptance.
The native earlier/later/only-today replay and notification rescheduling checks
remain open. No production release or migration is included.
