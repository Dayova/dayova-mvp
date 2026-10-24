# Owned local setup

Run commands from the task worktree with the pinned Node/pnpm toolchain. The
helper is `node scripts/dayova-task/resources.mjs`. Before switching checkouts,
record its **absolute source directory** as `TASK_HELPERS`. Before merge, the new
worktree's correct base may not contain this skill yet: run
`node "$TASK_HELPERS/resources.mjs" ...` and
`node "$TASK_HELPERS/metro.mjs" ...` with that worktree as cwd (or `--root` for the
resource helper). Do not change the task's base or copy helpers into its diff just
to obtain them. The source checkout must remain available while helpers run.
After merge the checkout-relative commands below work in updated worktrees.

The helper defaults the owner to
`CODEX_THREAD_ID`; otherwise pass `--owner CURRENT_CHAT_ID` consistently. An issue
ID is not an owner: two chats can work on the same issue. Never impersonate another
owner to resume a ledger. The ledger lives under the Git common directory's
`dayova-tasks/`, shared across worktrees but untracked, and stores no credentials.

## Worktree and access

1. Run `probe` in the source checkout. It actually creates/writes/removes probes
   in the private/common Git directories and `.agents`. On permission failure,
   stop setup and report it. Do not chmod, escalate, copy out, or substitute raw
   Git worktree commands to circumvent a denied managed operation.
2. Inspect `git status --short`, `git worktree list`, attachments and existing PRs.
   Prefer the matching owned attached worktree. A matching name alone grants no
   ownership. For new work, use Codex `create_worktree` with the explicit reviewed
   ref; wait for success and use its returned directory. If registration alone
   fails, use `attach_worktree` as directed by the tool. Outside Codex, an ordinary
   Git worktree may be created when supported and permitted, never as a bypass.
3. In the new worktree create a scoped branch with `git switch -c codex/TASK-SLUG`.
   Before commits, run `init --base REVIEWED_REF --task DAY-123` (or a short task
   description). First claim requires HEAD at the recorded base. Save the returned
   UUID as `TASK_ID`. Resume with `status --id TASK_ID`; don't initialize another
   chat's existing branch. A legacy task without a ledger requires an explicit
   ownership handoff before using it; otherwise create a new worktree.

The registry serializes allocations and refuses concurrent ownership. A stale
lock or crashed Metro record fails closed: inspect the owning terminal and
process provenance before manual reconciliation; never delete locks or kill PIDs
merely because they look old. Resource operations do not reset Git or remove
worktrees. Prefer preserving the checkout until the PR is reviewed.

## Simulator and Metro

```sh
node scripts/dayova-task/resources.mjs simulator --id "$TASK_ID" --model '17 Pro' --appearance dark
node scripts/dayova-task/resources.mjs port --id "$TASK_ID"
```

Add `--os '27.0'` for an exact installed version (or the exact runtime ID). Omitted
OS selects the newest installed compatible iOS runtime; omitted appearance is
light and omitted model is iPhone 17 Pro. State these defaults before testing.
Missing/ambiguous preferences that matter must be clarified. Unavailable models
or OS versions fail without substitution. The script always calls `simctl create`
for a new ledger, records the returned UDID before boot, sets appearance and
checks name/type/runtime when resuming or deleting. Partial boot failure remains
owned in the ledger: retry the same simulator command after inspecting the failure.

Never use `booted`, `shutdown all`, `erase all`, a globally named simulator, or
global `pkill`. Pass the returned UDID to **every** install, launch, screenshot,
recording and Maestro command. The existing `ci-run-maestro.mjs` and
`ci-prepare-maestro.mjs` assume a dedicated CI machine and use global device
selection; do not run them on this shared workstation. Use the documented
`test:smoke:ios --device UDID` route or explicit `maestro --device UDID` instead.
For Android requests, use a dedicated AVD and serial through the Expo guidance;
this allocator currently implements local iOS only. Do not claim Android coverage
or silently substitute iOS when an Android environment is unavailable.

After backend verification and exporting only approved public variables, start:

```sh
node scripts/dayova-task/metro.mjs --id "$TASK_ID"
```

Keep that command in an owned terminal session and record the terminal ID. It
starts only Expo, not `pnpm start`/`pnpm ios` (which also run Convex dev). It passes
the claimed port explicitly with noninteractive CI mode so Expo fails instead
of taking another port. Verify `/status` and the terminal's checkout/port before
opening the returned URL on the explicit device. It sets `EXPO_NO_DOTENV=1`,
development variant and disables analytics. It does not inherit backend secrets.
Claims coordinate this repository's worktrees; live socket checks also detect
other processes. A race with a non-participating process must fail, never kill it.
Stop via Ctrl-C in this owned terminal; the supervisor only signals its own child
process group. Cleanup refuses to run until the supervisor releases its record.

## Backend, build, QA identity and data

Follow [testing.md](../../../../docs/testing.md#local-ios-artifact-and-provenance),
the [platform contract](../../../../docs/contexts/platform/CONTEXT.md), `.env.example`,
and the [environment handbook](https://app.notion.com/p/3dc2e87228bf818a9547f588e2cf0386).
Verify through authenticated provider inventory/dashboard/CLI that the selected
Convex deployment is dev/preview/local, and read its deployed Clerk issuer. Check
the app's resolved endpoints and test publishable key against those observations.
Never infer this from a worktree, deployment name, `pk_test_`, or EAS environment.
If access to that evidence is missing, backend verification is blocked.

Write a temporary credential-free JSON receipt with `type`, `url`, `siteUrl`,
`clerkIssuer`, `source` (exact provider inspection/reference), and `isolation`:

- `shared-read-only`: no schema push, seed/reset, learner mutation or shared QA
  account changes. The reviewed CI development tenant is shared, not task-owned.
- `task-owned`: record `accountRef` (synthetic identity reference, no password)
  and `fixtureScope` plus evidence in `source` that these belong to this task.
  Verify exclusive account/data use, backend integration side effects and cleanup
  authority. If backend code differs, use local behavior tests until a separately
  authorized isolated deployment exists; this skill does not deploy.

Record with `backend --id TASK_ID --proof /absolute/path/to/receipt.json`.
This is an audit receipt of the agent's provider inspection, **not an independent
cloud verifier**. The Metro gate enforces matching endpoints/test issuer and
rejects absent/production receipts. Reverify on resume or configuration changes.

Use supported Clerk test registration/sign-in with a task-specific synthetic
identity and existing app/API paths for fixture creation after ownership is
verified. Use `MAESTRO_CI_EMAIL`/`MAESTRO_CI_PASSWORD` only from approved secret
storage, never log them or clone another worktree's `.env.local`. The existing
`auth-smoke.mjs` verifies real login/authenticated queries/anonymous denial for its
reviewed tenant; do not widen its allowlist to hide a setup failure. It does not
create a task-owned account. There is no generic production seeder or bypass.
Record reproducible minimal fixtures and created record IDs privately; use
supported account-scoped cleanup only. Do not reset shared deployment data.

Install dependencies in the owned checkout. Build a local simulator development
client using the documented Debug recipe, explicit approved environment,
`EXPO_NO_DOTENV=1`, and a task-local derived-data path; install on the explicit
UDID. Inspect app ID, simulator architecture, source/native fingerprint, signing,
updates and actual backend configuration. Reuse an artifact only with compatible
native fingerprint and verified provenance. `development-simulator` currently
uses production EAS variables; its name is not safe setup. No Expo Go or device
IPA. Paid cloud builds need separate authority. Verify login and the requested
fixture/reproduction before capturing baseline, then compare the same scenario
after implementation. Store only sanitized evidence on the PR.

## Cleanup

Stop the owned Metro terminal, finish owned recordings/builds, clean only owned
fixtures through supported paths, then run `cleanup --id TASK_ID`. It verifies
the simulator identity, shuts down/deletes only that UDID and releases the port.
It preserves the ledger, branch, worktree and backend evidence so the same chat
can resume after review. Reverify backend before the next runtime session. Record any
retained resources or failed cleanup; do not report complete cleanup on a partial
failure. Archive an unneeded managed worktree with Codex's archive tool after
publishing, preserving needed ignored artifacts first. Never remove another
chat's processes, simulator, branch, accounts or worktree.
