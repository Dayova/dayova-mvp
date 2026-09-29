# Contextual learning-time guidance — DAY-475

Follow-up to [DAY-417](https://linear.app/dayova/issue/DAY-417) and PR #651.
The product decision from the Philipp/Julius meeting on 29 September 2026
supersedes the previous daily and behavior-inference coaching proposal.

## Implemented contract

- Plan creation and the first learning action never require learning-time input.
- When no confirmed availability exists, grade-aware system defaults still make
  the plan usable immediately and remain visibly labeled as Dayova proposals.
- The Today dashboard does not open a learning-time popup and does not ask
  whether today's scheduled time still fits.
- The learning path does not surface inferred behavior-based schedule changes.
  A missed, early, or late session is not treated as a preference signal.
- After a completed Wissenscheck, one dismissible inline reminder explains that
  confirmed times help Dayova place upcoming steps more precisely. The learner
  can accept the visible proposal, adjust it in Lernzeiten, or continue.
- Learning remains possible at any time. Reminder permission remains independent
  from learning-time confirmation.
- Accepting or editing times affects future scheduling only. Started and
  completed progress remains intact.
- A dedicated one-off appointment rescheduler remains deferred until user
  evidence shows that it is a meaningful problem.

## Automated evidence

- `learning-plan-review-times.ui.test.tsx` verifies that the first learning step
  remains available without a learning-time question.
- `learning-time-suggestion-card.ui.test.tsx` verifies the contextual benefit
  copy and the voluntary accept, adjust, and later actions.
- `learning-plan-path-screen.ui.test.tsx` covers the learning-path surface after
  the behavior-based UI and Today popup were removed.
- Existing backend tests continue to protect grade-aware defaults and future-only
  rescheduling. Legacy public routine functions remain temporarily available for
  already distributed clients, but the current client no longer calls them.

Automated tests do not replace native visual inspection. The affected learning
path still requires a rendered iOS and Android check before release.
