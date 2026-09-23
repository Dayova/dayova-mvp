# Native account deletion follow-up (DAY-358 / PR #661)

Owner: Philipp Schossig. Implementation and checks: Codex-assisted.

## Observed failure

The QA integration build showed a deletion error on the disposable iPad,
iPhone and Android accounts. This is not a successful deletion test.
The observed request returned before database reads/writes, consistent with
the recent-first-factor gate; provider worker completion has not been proven.

## Client correction

- Both profile and expired-trial entry points request the current password in
  a secure, keyboard-aware Dayova sheet field.
- Reuse the existing first-factor verification helper, then explicitly obtain
  an uncached Convex-template token for the deletion mutation.
- Do not sign out unless the server explicitly returns `status: accepted`.
- Clear the password on cancellation and after an attempt. Do not persist or log it.
- Preserve all server-side authorization, retention and provider-deletion gates.

`accepted` means the server queued the request, **not** that all providers
have finished deleting data.

## Automated validation

- Vitest: 120 files, 788 tests passed.
- Profile, paywall and session UI tests: 27 tests passed.
- Shared sheet UI tests: 10 tests passed.
- TypeScript and changed-source ESLint passed.

## Required native follow-up — still open

For each disposable platform account, capture the empty confirmation field,
verify keyboard reachability, enter the password privately, and submit once.
Record accepted request and eventual worker/provider completion separately.
Confirm return to signed-out UI and that the deleted account cannot sign in.
Never publish passwords, tokens, or unredacted account identifiers in evidence.

No production deployment or OTA release is certified by these checks.
