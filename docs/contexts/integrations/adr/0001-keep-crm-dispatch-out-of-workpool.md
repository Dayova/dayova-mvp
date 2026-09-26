# Keep CRM dispatch on the existing queue for now

Status: tested and not adopted (2026-09-25). Applies to the CRM sync in [DAY-366](https://linear.app/dayova/issue/DAY-366) and [PR #695](https://github.com/Dayova/dayova-mvp/pull/695).

The CRM already coalesces profile changes by user in `crmStudentUpdates`, advances each row with a revision check, and serializes Notion work with the `crmSyncState` lease. Signup creation can have an uncertain outcome, so a whole reconciliation action cannot be retried automatically. Workpool can limit parallel jobs, but it does not replace the queue, revision guard, lease, or manual review state.

I tried `@convex-dev/workpool@0.4.12` with one CRM pool (`maxParallelism: 1`, action retries disabled). The prototype routed immediate updates, audit continuation, and the two crons through that pool. It compiled with `pnpm typecheck`. I registered the component in the Convex test harness and ran `pnpm exec vitest run convex/crmSync.test.ts`: 21 passed and 7 failed. Background jobs that previously remained cancellable as scheduled `crmSync` functions ran during direct audit tests, changing the order of Notion writes and invalidating scheduler-count assertions. This exposed a real second scheduling path around manual reconciliation; addressing it requires more orchestration and test changes, while the existing lease is still required for direct calls. After removing the prototype, all 28 CRM tests passed again.

Keep the current dispatcher until queue depth, overlapping action attempts, or Convex scheduler pressure is observed. If that happens, retry Workpool with one entry point for *all* live reconciliation, explicit deduplication of wakeups, and tests for manual runs alongside queued jobs. Keep automatic action retries off unless Notion creation has an idempotency guarantee.

Reference: [Workpool documentation](https://github.com/get-convex/workpool#readme).
