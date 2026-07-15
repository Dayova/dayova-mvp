# Auth and Identity Context

This context covers authentication, identity, organizations, roles, permissions, and provider-specific integration decisions.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology, conventions, and assumptions that agents need while working in this repo.

## Notes

- Registration is password-based: the learner enters an E-Mail address, sets a
  password, then confirms the account with a 6-digit E-Mail code.
- Native session lifetime, per-device logout, compromise response, app-lock,
  and step-up decisions are recorded in
  [ADR 0001](adr/0001-native-session-policy.md).
- Capture auth provider, identity mapping, and authorization decisions here.
- Put auth ADRs in `docs/contexts/auth/adr/`.
