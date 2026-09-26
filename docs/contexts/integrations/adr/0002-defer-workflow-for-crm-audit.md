# Defer Workflow for the CRM audit

Status: evaluated, not integrated (2026-09-25). Builds on [Workpool evaluation](0001-keep-crm-dispatch-out-of-workpool.md) for [DAY-366](https://linear.app/dayova/issue/DAY-366).

The current audit is already a durable, bounded state machine: `crmSyncState` stores the `students → links → paid` phase, cursor, failure count, lease, dry-run gate, and last successful audit. Each `crmSync.reconcile` action processes one page, commits progress, and schedules the next page. The focused test `pnpm exec vitest run convex/crmSync.test.ts -t "live audit checkpoints and completes an inventory larger than 200"` passes, covering 201 contacts across multiple invocations.

I mapped the audit to `@convex-dev/workflow` steps. A workflow around the current `reconcile` action would **add** persisted step state while `crmSyncState` still owns the cursor and operator-facing status. Replacing `crmSyncState` would require moving the dry-run gate, lease for direct/manual calls, failure reporting, and in-flight audit recovery into a new contract. The current action also returns a failure result instead of throwing, so Workflow would treat a failed batch as a successful step unless its interface changes. Automatic retry of a step containing an uncertain Notion `POST /pages` must remain disabled. Workflow therefore cannot replace the safety-critical parts of the current audit with a small migration.

No Workflow component was installed or run against the CRM in this PR. The experiment was an interface/state mapping plus the existing multi-page audit test, not a runtime benchmark of Workflow. Revisit it when an audit needs independent, genuinely multi-step work across providers or when the current cursor/scheduler logic becomes a measured reliability problem. A replacement should first split Notion creation into an at-most-once step with explicit recovery, then migrate existing audit state without two active orchestrators.

Reference: [Workflow documentation](https://github.com/get-convex/workflow#readme).
