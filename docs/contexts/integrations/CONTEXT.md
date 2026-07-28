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

The Validation Phase contract exists to answer only four questions: whether a
learner activated, started and finished a real learning block, recovered from a
missed block, and returned on a later day. Events are emitted only after the
corresponding backend action succeeds.

The Clerk user ID is the PostHog `distinctId` and is not duplicated as a
`clerk_id` property. The exact custom person-property set is:

- `convex_user_id`, when defined
- `validation_student_code`, when defined
- `grade`, only one of `6`, `7`, `8`, `9`, `10`, `11`, `12`, or `13`
- `state`, only one of the 16 German federal-state names used by onboarding

The product `Schulart` field is bounded by DAY-253, but `school_type` remains
intentionally excluded from PostHog. Adding it requires a separate, reviewed
change to this analytics contract; the product field alone does not authorize
collection.

Every custom event receives `analytics_schema_version` centrally. It may also
receive `validation_student_code`, `eas_update_id`, `eas_channel`,
`eas_runtime_version`, and `eas_is_embedded_launch` when defined. DAY-220 owns
populating the EAS values.

The exact event-specific property contract is:

| Event | Properties |
| --- | --- |
| `onboarding_completed` | `local_day_key`, `onboarding_version` |
| `homework_created` | `day_entry_id`, `planned_day_key`, `due_day_key`, `duration_minutes` |
| `exam_created` | `day_entry_id`, `planned_day_key`, `duration_minutes`, `exam_type` |
| `material_uploaded` | `learning_plan_id`, `file_type`, `file_size_bucket` |
| `study_plan_generated` | `learning_plan_id`, `session_count` |
| `study_slot_started` | slot context plus `started_at` |
| `study_slot_completed` | slot context plus `outcome_at` |
| `study_slot_partially_completed` | slot context plus `outcome_at` |
| `study_slot_missed` | slot context plus `outcome_at` and `missed_reason` |
| `plan_adjusted` | `original_session_id`, `new_session_id`, `adjustment_type`, `old_planned_day_key`, `new_planned_day_key`, `old_duration_minutes`, `new_duration_minutes`, and optional `missed_reason` |
| `user_returned_next_day` | `local_day_key`, `previous_activity_day_key` |

Slot context is exactly `learning_plan_id`, `learning_plan_session_id`, `phase`,
`planned_day_key`, `planned_start_time`, `duration_minutes`, and optional
`deadline_day_key`. Bounded values are:

- `phase`: `theory`, `practice`, `rehearsal`
- `missed_reason`: `no_time`, `forgot`, `no_motivation`, `too_hard`, `too_big`, `unclear`, `other`
- `adjustment_type`: `rescheduled`, `shortened`, `rescheduled_and_shortened`
- `exam_type`: the seven existing picker values (`Test`, `Kurzkontrolle`, `Leistungskontrolle`, `Klassenarbeit`, `Klausur`, `Mündliche Prüfung`, `Präsentation`)
- `file_type`: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `text/plain`, `text/markdown`, `text/csv`, `application/json`, `image/jpeg`, `image/png`, `image/webp`, or the bounded unknown fallback `application/octet-stream`
- `file_size_bucket`: `lt_1_mb`, `1_to_10_mb`, `10_to_50_mb`, `gte_50_mb`, using 1 MiB boundaries
- `state`: `Baden-Württemberg`, `Bayern`, `Berlin`, `Brandenburg`, `Bremen`, `Hamburg`, `Hessen`, `Mecklenburg-Vorpommern`, `Niedersachsen`, `Nordrhein-Westfalen`, `Rheinland-Pfalz`, `Saarland`, `Sachsen`, `Sachsen-Anhalt`, `Schleswig-Holstein`, `Thüringen`

`analytics_schema_version` and `onboarding_version` are both `1` for this
contract version.

Generalprobe completion is derived from `study_slot_completed` with
`phase === "rehearsal"`. Missed reason is carried by `study_slot_missed`; there
are no `generalprobe_completed` or `missed_reason_selected` events. Dashboard
usability is learned qualitatively during this phase, so there are no
`dashboard_*` events.

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
- Names, email addresses, birth dates, avatar URLs, school names, raw notes, filenames, uploaded content, learner answers, transcripts, and diagnostic error detail are never custom person or event properties.
- `src/lib/analytics.ts` is the executable contract. It projects exact keys and validates values at runtime; development and tests throw, while production omits invalid optional values and drops events with invalid required values. The PostHog `before_send` hook repeats the projection as defense in depth while preserving SDK/system properties.
- Capture integration ownership, external IDs, sync boundaries, and migration decisions here.
- Put integrations ADRs in `docs/contexts/integrations/adr/`.
