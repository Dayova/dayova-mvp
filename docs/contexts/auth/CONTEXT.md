# Auth and Identity Context

This context covers authentication, identity, organizations, roles, permissions, and provider-specific integration decisions.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology, conventions, and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

## Notes

- Registration is password-based: the learner enters an E-Mail address, sets a
  password, then confirms the account with a 6-digit E-Mail code.
- Native session lifetime, per-device logout, compromise response, app-lock,
  and step-up decisions are recorded in
  [ADR 0001](adr/0001-native-session-policy.md).
- The auth provider intentionally exposes three narrow interfaces:
  `useAuthSession` for identity/session state, `useAuthFlow` for sign-in,
  registration and recovery, and `useAccountActions` for authenticated account
  mutations. Screens must not depend on a broader auth surface than they use.
- Native Clerk tokens always use Clerk's secure persistent Expo token cache.
  There is no `Angemeldet bleiben` preference or memory-only cache path.
- Password recovery uses neutral account-existence copy, signs out other
  sessions after a successful reset, and supports Clerk's forced
  `reset-password` session task at `/session-tasks/reset-password`. Recovery
  and forced reset finish on `/password-reset-success`, where the learner is
  told that all other devices were signed out.
- Signed-in password changes first perform a recent Clerk first-factor password
  verification and then update the password with
  `signOutOfOtherSessions: true`.
- Implementation is tracked by
  [DAY-90](https://linear.app/dayova/issue/DAY-90/implement-password-recovery-forced-reset-and-password-change)
  and
  [DAY-178](https://linear.app/dayova/issue/DAY-178/remove-angemeldet-bleiben-and-verify-persistent-native-sign-in),
  a child of DAY-109.
- Capture auth provider, identity mapping, and authorization decisions here.
- Put auth ADRs in `docs/contexts/auth/adr/`.

## Verification contract

- Unit tests cover routing decisions, unknown-account recovery privacy,
  reverification, session revocation, validation dependencies, and synchronous
  double-action prevention.
- React Native Testing Library covers login/recovery privacy and cancellation,
  forced reset, session-invalidation success messaging, accessible native
  switches, and the controlled bottom-sheet lifecycle race.
- DAY-90 and DAY-178 require real-device evidence before closure. DAY-178 also
  requires persistence across process/device restart and remote-revocation
  behavior, not merely a successful unit test.
