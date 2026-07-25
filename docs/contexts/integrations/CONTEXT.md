# Integrations Context

This context covers third-party services and external system boundaries, including documentation, issue tracking, analytics, AI services, payments, email, and future migrations.

Notion is Dayova's main internal documentation and knowledge workspace. Linear owns actionable work and workflow state; GitHub owns code and pull requests. Link these systems rather than duplicating their records.

Linear workspace `dayova`, team `Dayova` (`DAY`), is the source of truth for issues and PRDs. GitHub Issues for `Dayova/dayova-mvp` is a bidirectionally synced compatibility surface, and linked pull requests drive Linear workflow status automation. Agent-facing operation rules live in `docs/agents/issue-tracker.md`.

## Language

**PostHog Student Profile**:
An identifiable analytics profile for a validation-phase student, used to connect in-app behavior with the team's Notion validation-student database.
_Avoid_: Treating PostHog as the source of record for full research notes or qualitative interview data.

**Validation Student Table**:
The canonical [🎓 Students database](https://app.notion.com/p/cf81d5caf5944c349b76cfa532c94d5c) used by non-technical team members to manage test students, their real deadlines, check-ins, and qualitative observations.
_Avoid_: Splitting founder-facing validation notes across multiple unlinked tools.

**Validation Student Code**:
A short Dayova-owned code such as `S1` or `S2` that links a student in the Notion validation-student database to their app user and PostHog profile.
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
