# Integrations Context

This context covers third-party services and external system boundaries, including documentation, issue tracking, analytics, AI services, payments, email, and future migrations.

Confluence is the current cross-functional documentation hub and may later move to Notion.

GitHub Issues is the current issue tracker. A planned migration to Linear is tracked in https://github.com/Dayova/dayova-mvp/issues/20.

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

- Capture integration ownership, external IDs, sync boundaries, and migration decisions here.
- Put integrations ADRs in `docs/contexts/integrations/adr/`.
