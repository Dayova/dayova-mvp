---
status: accepted
---

# Defer learning-time confirmation until after plan creation

[DAY-417](https://linear.app/dayova/issue/DAY-417/remove-manual-learning-times-from-the-critical-path-and-generate-defaults)
removes manual learning-time setup from the essential path between adding an
exam and starting the first learning step.

Material/extraction failures remain in
[DAY-423](https://linear.app/dayova/issue/DAY-423/recover-learning-plan-creation-when-uploaded-material-cannot-produce-a),
so schedule bootstrapping does not mask or relabel those recovery cases.

## Decision brief

- **Job:** give a learner a usable first learning step as soon as exam scope and
  school material are available.
- **Hierarchy:** the next learning action first, proposed scheduling context
  second, preference refinement third.
- **Primary action:** start the first learning step.
- **Friction:** defer manual availability entry and do not turn schedule
  precision into a plan-generation gate.
- **Chosen decision:** learning times are absent from onboarding and exam setup.
  When no confirmed times exist, generate grade-aware system defaults, persist
  them as unconfirmed defaults, and schedule the rolling two-session window from
  them. Offer confirmation or editing after the plan exists and remind once
  after the Wissenscheck without interrupting learning.

## Automatic scheduling policy

- Grades 5–8: 16:00–20:00.
- Grades 9–10: 16:00–22:00.
- Grade 11 and above: 16:00–midnight. Store midnight as `00:00` and interpret it
  as the end of the same scheduling day.
- Missing grade: use the conservative 16:00–20:00 fallback.
- Choose up to three upcoming recurring days that can still fit before the exam.
  On the current day, start after the current time instead of scheduling in the
  past.

These windows guide automatic scheduling. They never prevent a learner from
opening a learning step earlier or later, and an explicitly confirmed preference
remains authoritative.

## Contextual refinement

Dayova does not interrupt the learner with daily check-ins or infer a preferred
routine from individual start times. After the Wissenscheck, the learning path
may show one dismissible, inline reminder while the grade-aware defaults remain
unconfirmed. It explains the benefit in context and offers three voluntary
choices: accept the visible proposal, adjust it, or continue learning.

The reminder never opens automatically as a sheet, never competes with the next
learning action, and does not treat a missed or shifted session as a preference.
Regular learning times remain available in settings at all times.

## Consequences

- Existing learning times remain authoritative and are never overwritten by
  defaults.
- System defaults are visibly distinct from confirmed preferences in the plan
  prompt and learning-time settings.
- Continuing to learn dismisses the initial prompt for that plan but does not
  silently confirm the proposal.
- Accepting or editing a proposal converts the current proposed windows into
  confirmed preferences.
- Learning-time changes reschedule only sessions that have not started.
  Completed, partially completed, missed, adjusted, or currently started
  sessions and their evidence remain intact.
- If even a safe provisional window cannot fit before the assessment, the
  learner receives a concrete recovery instruction instead of a generic plan
  generation failure.
- The Today dashboard never asks whether a scheduled time still fits. Moving a
  single appointment is deferred until user evidence establishes that this is a
  meaningful problem rather than another routine prompt.
