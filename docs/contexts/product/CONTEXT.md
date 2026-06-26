# Product and Learning Domain Context

This context covers Dayova's product language, learning model, user journeys, content taxonomy, quizzes, study sessions, progress, and other domain concepts.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology and assumptions that agents need while working in this repo.

## Glossary

**Validation Phase**:
The founder-led learning cohort used to prove whether Dayova helps learners
create plans, start real study blocks, recover from missed blocks, and return on
the next day.

**First Real Block**:
The first scheduled learning-plan session a learner starts after a plan is
generated and accepted. It is the main activation moment after onboarding.

**Product Signal**:
Evidence that the learner completed an action because the product itself helped
them, not because a founder manually intervened.

**Accountability Signal**:
Evidence that founder check-ins, reminders, or other external accountability
helped the learner complete or recover a study block.

**Core Loop**:
Create exam or homework, generate a learning plan, start a planned study slot,
record the outcome, and return the next day.

**Recovery Loop**:
When a learner misses a study slot, collect the missed reason and create a
smaller linked recovery block instead of treating the plan as simply failed.

**Generalprobe**:
The rehearsal phase of a learning plan. A completed rehearsal session emits the
`generalprobe_completed` validation event.

## Notes

- Capture repo-relevant summaries or links to Confluence decisions here.
- Put product/domain ADRs in `docs/contexts/product/adr/`.
