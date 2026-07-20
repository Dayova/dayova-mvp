# ADR: Use Persistent Per-Device Native Sessions

- Status: Accepted
- Date: 2026-07-14
- Product decision: [DAY-176](https://linear.app/dayova/issue/DAY-176/define-dayovas-native-authentication-session-policy)
- Delivery model: [Notion decision record](https://app.notion.com/p/39d2e87228bf8081b08aff1b2990b860)

## Context

Dayova currently runs only as a native phone/tablet app. Learners normally use
their own OS-protected devices, and one learner may legitimately use the same
account on both a phone and a tablet. Shared school or family devices are not a
supported use case today.

The production Clerk screenshots reviewed for DAY-176 show a 7-day maximum
session lifetime, no inactivity timeout, multi-session handling disabled,
Client Trust enabled, bot sign-up protection enabled, and a 100-attempt/1-hour
lockout.

## Decision

Use secure session persistence by default and do not ask learners to choose
`Angemeldet bleiben` during sign-in or sign-up.

| Area | Policy |
| --- | --- |
| Maximum lifetime | 30 days per device/session. Reauthentication starts a new bounded session. |
| Inactivity timeout | Disabled. Closing the app or taking a study break does not itself sign the learner out. |
| Phone and tablet | Independent concurrent sessions are allowed. Signing in on one personal device does not end the other device's session. |
| Clerk multi-session handling | Disabled. Clerk uses this setting for multiple accounts on one client, not one account across multiple devices. |
| Normal `Abmelden` | End the current Clerk client's session and clear its local token material. Other personal devices remain signed in. |
| Global sign-out | A future explicit `Von allen Geräten abmelden` security action revokes every active session. |
| App lock | None for the current personal-device, lower-risk product. Reconsider for communal devices, materially more sensitive data, or a customer requirement. |
| Step-up authentication | Require recent reverification for account deletion, password/email/MFA changes, session revocation, and personal-data export. Use a 10-minute freshness window. |

Thirty days is a product-risk choice, not a claim that Dayova is certified
under NIST. NIST's AAL1 guidance recommends a definite overall timeout no
longer than 30 days and treats inactivity timeout as optional. This improves
substantially on Clerk's 7-day default without making the session unbounded.

## Session Termination And Recovery

| Event | Required behavior |
| --- | --- |
| App backgrounding, process restart, device restart, or app update | Restore the securely cached session while it remains valid. |
| Maximum lifetime reached or server revocation | Return that device to sign-in with neutral German copy and no stale learner data. |
| Normal sign-out | End only the current device/client session. The current `clerk.signOut()` call with Clerk multi-session handling disabled matches this policy. |
| Password change while signed in | Reverify and set `signOutOfOtherSessions: true`; keep the newly verified current session. |
| Forgotten-password recovery | After the verified reset, sign in the recovered device and set `signOutOfOtherSessions: true`. |
| Email or MFA change | Reverify immediately before the change and notify the existing verified contact where supported. Revoke all sessions if the change was not authorized. |
| One identifiable suspicious session | Revoke that session and notify the learner; preserve known-good phone/tablet sessions. |
| Password compromise or uncertain compromise scope | Mark the password compromised, revoke all sessions, require a password reset, and notify the learner. |
| Account deletion | Reverify, obtain explicit confirmation, make every Clerk session unusable, delete the Clerk user, synchronously prevent further Dayova-data access, clear local data, and complete the app's data deletion/anonymization policy. Verify on two devices. |

An already issued Clerk session JWT normally remains cryptographically valid
until its short expiry, even after server-side revocation. Sensitive backend
operations must therefore enforce the account's current Dayova-side state as
well as token validity during deletion/containment flows.

## Suspected Compromise

Treat the following as actionable compromise signals:

- a lost or stolen device that the learner cannot secure;
- an unfamiliar-device/session notification the learner does not recognize;
- a password known or reasonably believed to be phished, leaked, or reused in
  a breached service;
- unauthorized account changes; or
- credible evidence that a session token was copied.

A legitimate new phone/tablet is not compromise. Client Trust should verify it
with an additional factor before activation. Weak signals such as an unusual
location should trigger verification or review, not automatic punishment.

## Clerk Configuration

- Change maximum lifetime from 7 to 30 days. A custom production duration
  requires a paid Clerk plan.
- Keep inactivity timeout disabled.
- Keep multi-session handling disabled.
- Keep Client Trust enabled. Dayova's custom login already handles
  `needs_client_trust` with email-code verification.
- Keep the 100-attempt/1-hour lockout unless operational evidence supports a
  lower threshold. This is Clerk's default and avoids making account-lockout
  denial of service too easy.
- Keep bulk user-enumeration protection for the current UX/security trade-off.
- Keep bot sign-up protection enabled and verify the custom Expo sign-up flow
  provides and tests Clerk's CAPTCHA host/fallback behavior.
- Verify the unfamiliar-device email template and support contact; enable its
  one-click suspicious-session revocation when the production plan supports it.

## Consequences And Open Implementation Work

- [DAY-178](https://linear.app/dayova/issue/DAY-178/remove-angemeldet-bleiben-and-verify-persistent-native-sign-in)
  removes the sign-in persistence checkbox, rebalances the layout directly in
  the app, and removes the preference-aware memory-only token-cache path.
  Existing Figma is a visual reference, not an approval or sequencing gate.
- [DAY-184](https://linear.app/dayova/issue/DAY-184/subscribe-to-clerk-pro-and-activate-production-auth-settings)
  owns the Clerk Pro purchase, the production 30-day maximum-lifetime change,
  Dashboard evidence, and final production-auth release QA. This dated release
  gate does not block earlier app implementation.
- Dayova implements Clerk's forced reset-password session task through the
  native `/session-tasks/reset-password` route with automated coverage. The
  production password-compromise response remains disabled until this route
  also passes real-device verification of both pending-session routing and a
  successfully completed reset. This release gate is separate from the normal
  password-recovery flow and its real-device QA.
- Real-device QA must cover two-device coexistence, current-device logout,
  expiry, remote revocation, normal password recovery, forced-reset routing and
  completion, and account deletion.
- Shared/temporary-device mode is explicitly deferred until evidence shows it
  is needed.

## Primary Sources

- [Clerk session options](https://clerk.com/docs/guides/secure/session-options)
- [Clerk Client object](https://clerk.com/docs/expo/reference/objects/client)
- [Clerk Client Trust](https://clerk.com/docs/guides/secure/client-trust)
- [Clerk user lockout](https://clerk.com/docs/guides/secure/user-lockout)
- [Clerk unauthorized-sign-in protection](https://clerk.com/docs/guides/secure/best-practices/unauthorized-sign-in)
- [Clerk session revocation](https://clerk.com/docs/reference/backend/sessions/revoke-session)
- [Clerk compromised-password action](https://clerk.com/docs/reference/backend/user/set-password-compromised)
- [Clerk password recovery](https://clerk.com/docs/guides/development/custom-flows/authentication/forgot-password)
- [Clerk reverification](https://clerk.com/docs/guides/secure/reverification)
- [NIST SP 800-63B session management](https://pages.nist.gov/800-63-4/sp800-63b/session/)
- [NIST SP 800-63B AAL1 reauthentication](https://pages.nist.gov/800-63-4/sp800-63b/aal/)
- [OWASP mobile authentication and session management](https://mas.owasp.org/MASTG/0x04e-Testing-Authentication-and-Session-Management/)
- [Apple Local Authentication](https://developer.apple.com/documentation/localauthentication/logging-a-user-into-your-app-with-face-id-or-touch-id)
- [Android biometric authentication](https://developer.android.com/identity/sign-in/biometric-auth)
