# Auth and Identity Context

This context covers authentication, identity, organizations, roles, permissions, and provider-specific integration decisions.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology, conventions, and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

## Notes

- Registration is password-based: the learner enters an E-Mail address, sets a
  password, then confirms the account with a 6-digit E-Mail code.
- Apple and Google social login are intentionally unsupported. Do not enable
  provider UI, dependencies, or native capabilities without a new product and
  authentication decision that covers cross-platform account linking and
  account lifecycle behavior.
- Launch onboarding restores a three-page product explanation, then collects
  duration, recurring weekdays, and a start time. After authentication these
  values create the `userLearningTimes` windows consumed by learning-plan
  scheduling; local copy changes alone are not accepted as personalization.
  The stable implementation contract and canonical product-decision pointer
  live in
  [ADR 0002](adr/0002-onboarding-e2e-launch-flow.md).
- Onboarding profile/account steps are native history entries in the existing
  auth stack. Answers and field errors live above route screens; the route
  history, not a parallel `activeIndex`, owns forward/back navigation. The
  three homogeneous intro pages remain one native pager route, and a cold
  direct step URL falls back to the auth choice. See
  [mobile-app ADR 0003](../mobile-app/adr/0003-model-onboarding-as-native-stack-history.md).
- Clerk `unsafeMetadata.schoolType` stores only the stable bounded `Schulart`
  key. Exact generic legacy labels are normalized on authentication; ambiguous
  values such as school names are removed without including the raw value in
  diagnostics.
- Native session lifetime, per-device logout, compromise response, app-lock,
  and step-up decisions are recorded in
  [ADR 0001](adr/0001-native-session-policy.md).
- The auth provider intentionally exposes three narrow interfaces:
  `useAuthSession` for identity/session state, `useAuthFlow` for sign-in,
  registration and recovery, and `useAccountActions` for authenticated account
  mutations. Screens must not depend on a broader auth surface than they use.
- Native Clerk tokens always use Clerk's secure persistent Expo token cache.
  There is no `Angemeldet bleiben` preference or memory-only cache path.
- Pending onboarding persistence uses a separate outbox. Native builds store it
  in encrypted SecureStore. Production web rejects durable recovery until an
  encrypted web-storage design is accepted. Development web may use
  origin-scoped browser storage only for local debugging and only for the same
  non-secret operational payload. It is
  bound to the Clerk registration attempt and eventual Clerk user, is resumed
  before normal app routing after a process restart, and removes the answer
  payload only after Convex confirms success. Never add credentials,
  verification codes, tokens, names, birth dates, or raw e-mail addresses to
  this outbox. The full lifecycle contract lives in ADR 0002.
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
