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

## PostHog Validation Analytics

PostHog is the product analytics destination for the validation cohort. The
mobile client initializes PostHog only from optional public env values:

- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`

Validation events are emitted after backend success for onboarding completion,
homework and exam creation, uploaded material, generated study plans, study slot
start/outcomes, missed reasons, recovery planning, next-day returns, and
general probe completions.

## Validation Student Profile

`validationStudentCode` is the cross-system identifier used for founder-led
validation. It can come from Clerk unsafe metadata, is synced onto the Convex
`users` row, and is copied into PostHog person properties/events as
`validation_student_code`.

The founder-only Convex role is `validationRole: "founder"`. It is not synced
from Clerk metadata by normal mobile flows; seed or patch it intentionally for
internal users.

## Notes

- PostHog identifies validation-phase students with Clerk's stable user ID. The Validation Student Code should live in Dayova data, not Clerk auth metadata, and should be sent to PostHog as a profile property when present.
- PostHog tracking is identified-only during the Validation Phase. Anonymous pre-auth app activity, autocapture, lifecycle events, and session replay are intentionally out of scope unless login or onboarding becomes a measured blocker.
- Capture integration ownership, external IDs, sync boundaries, and migration decisions here.
- Put integrations ADRs in `docs/contexts/integrations/adr/`.
