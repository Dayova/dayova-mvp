# Integrations Context

This context covers third-party services and external system boundaries, including documentation, issue tracking, analytics, AI services, payments, email, and future migrations.

Confluence is the current cross-functional documentation hub and may later move to Notion.

GitHub Issues is the current issue tracker. A planned migration to Linear is tracked in https://github.com/Dayova/dayova-mvp/issues/20.

## Language

**PostHog Student Profile**:
An identifiable analytics profile for a validation-phase student, used to connect in-app behavior with the team's Confluence-based student table.
_Avoid_: Treating PostHog as the source of record for full research notes or qualitative interview data.

**Validation Student Table**:
The Confluence-based table used by non-technical team members to manage test students, their real deadlines, check-ins, and qualitative observations.
_Avoid_: Splitting founder-facing validation notes across multiple unlinked tools.

**Validation Student Code**:
A short Dayova-owned code such as `S1` or `S2` that links a student in the Confluence validation table to their app user and PostHog profile.
_Avoid_: Using email address or full name as the stable join key between tools.

## Notes

- PostHog identifies validation-phase students with Clerk's stable user ID. The Validation Student Code should live in Dayova data, not Clerk auth metadata, and should be sent to PostHog as a profile property when present.
- PostHog tracking is identified-only during the Validation Phase. Anonymous pre-auth app activity, autocapture, lifecycle events, and session replay are intentionally out of scope unless login or onboarding becomes a measured blocker.
- Capture integration ownership, external IDs, sync boundaries, and migration decisions here.
- Put integrations ADRs in `docs/contexts/integrations/adr/`.
