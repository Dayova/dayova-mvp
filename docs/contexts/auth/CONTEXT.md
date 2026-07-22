# Auth and Identity Context

This context covers authentication, identity, organizations, roles, permissions, and provider-specific integration decisions.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology, conventions, and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

## Notes

- Registration is password-based: the learner enters an E-Mail address, sets a
  password, then confirms the account with a 6-digit E-Mail code.
- Clerk `unsafeMetadata.schoolType` stores only the stable bounded `Schulart`
  key. Exact generic legacy labels are normalized on authentication; ambiguous
  values such as school names are removed without including the raw value in
  diagnostics.
- Native session lifetime, per-device logout, compromise response, app-lock,
  and step-up decisions are recorded in
  [ADR 0001](adr/0001-native-session-policy.md).
- Capture auth provider, identity mapping, and authorization decisions here.
- Put auth ADRs in `docs/contexts/auth/adr/`.
