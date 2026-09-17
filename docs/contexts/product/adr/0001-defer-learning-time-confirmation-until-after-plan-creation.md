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
- **Chosen decision:** when no learning times exist, generate conservative
  provisional defaults, persist their proposed status, and schedule the rolling
  two-session window from them. Offer confirmation or editing after the plan
  exists and remind once after the Wissenscheck without interrupting learning.

## Consequences

- Existing learning times remain authoritative and are never overwritten by
  defaults.
- Proposed defaults are visibly distinct from confirmed preferences in the
  plan prompt and learning-time settings.
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
