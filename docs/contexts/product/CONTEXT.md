# Product and Learning Domain Context

This context covers Dayova's product language, learning model, user journeys, content taxonomy, quizzes, study sessions, progress, and other domain concepts.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology and assumptions that agents need while working in this repo.

## Language

**Persönlicher Lernplan**:
The user-facing learning-plan creation flow and accepted study path. It frames the five short pre-plan questions and optional learning material as the setup for a personalized, ordered plan whose sessions build toward exam readiness.
_Avoid_: Wissensanalyse, Quiz

**Nächster Lernschritt**:
The next unfinished session in a `Persönlicher Lernplan`. It is the recommended continuation point, while later sessions can remain visible for flexibility.
_Avoid_: Hard lock, hidden future sessions

**Pre-plan diagnostic step**:
The internal name for the five-question diagnostic part of `Persönlicher Lernplan`, used when distinguishing it from post-session `Wissensanalyse`.
_Avoid_: User-facing copy

**Wissensanalyse**:
The post-session analysis shown after `Üben` or `Praxis`. It summarizes the learner's strengths, knowledge or execution gaps, and near-term recommendations for the ongoing plan.
_Avoid_: Using this term for the pre-plan diagnostic step in new user-facing copy

**Lernkarte**:
A theory card for active recall: the front side prompts the learner with a concrete concept, formula, definition, or understanding question; the back side gives the precise answer with details, an example, a memory cue, and common pitfalls when useful.
_Avoid_: Graded quiz question, exercise, generic session summary

**Lernkarten-Wiederholung**:
The learner marks a specific `Lernkarte` for another pass in the same theory session. A theory session is complete when every card has been confirmed as understood at least once.
_Avoid_: Restarting the whole theory session, grading the learner

**Üben**:
The guided practice phase of a learning session. It mixes multiple-choice, written, and spoken tasks, then gives answer-level feedback with a rating, explanation, and ideal answer.
_Avoid_: Only drilling the learner's mistakes, single-mode quiz

**Praxis**:
The user-facing name for the rehearsal or `Generalprobe` phase. It simulates a timed test with mixed task types and leads into a `Wissensanalyse`.
_Avoid_: Treating Praxis as a fourth phase separate from rehearsal

**Validation Phase**:
A focused learning period where Dayova is tested with a small number of students who have real school deadlines, to learn whether the product causes earlier and more committed action.
_Avoid_: Treating generic app usage, polite feedback, or TestFlight downloads as validation.

**Schulart**:
The optional, coarse category a learner selects during onboarding. Store one stable key (`gymnasium`, `secondary_general`, `comprehensive`, `hauptschule`, `vocational`, `other`, or `prefer_not_to_say`) and show its German label; `prefer_not_to_say` is the ordinary “Keine Angabe” choice.
_Avoid_: School name, free-text school field, inferring a category from an identifiable name

**First Real Block**:
The first genuine learning or work block a student starts for a real exam, assignment, presentation, or graded task before the last possible moment.
_Avoid_: Counting planning-only activity or artificial test tasks as this signal.

**Product Signal**:
Observed behavior that suggests Dayova itself helped the student act, such as starting a slot without a personal check-in, returning voluntarily, or entering a second real use case.
_Avoid_: Mixing this with action triggered by a founder or coach message.

**Accountability Signal**:
Observed behavior that happens reliably after a personal check-in or reminder, showing that accountability may be part of the product value.
_Avoid_: Treating check-in-driven action as pure product-loop success.

**Core Loop**:
The product behavior loop of entering a real task, seeing the next step, starting, documenting the result, replanning after failure, and returning.
_Avoid_: Describing the loop as app engagement or calendar usage.

**Recovery Loop**:
The part of the Core Loop where a missed or failed slot is explained, made smaller or replanned, and attempted again.
_Avoid_: Treating missed slots only as churn or lack of motivation.

**Generalprobe**:
The validation readout term for completing a `Praxis` rehearsal session.
_Avoid_: Treating Generalprobe as a fourth learner-facing phase separate from Praxis

## Notes

- Capture repo-relevant summaries or links to Confluence decisions here.
- Put product/domain ADRs in `docs/contexts/product/adr/`.

## Example Dialogue

Domain: "The learner sees this as their `Persönlicher Lernplan`, not as a diagnostic quiz."
Engineer: "So I can use `pre-plan diagnostic step` internally, but the UI copy should say things like `Beantworte 5 kurze Fragen für deinen persönlichen Lernplan`?"
Domain: "Right. `Wissensanalyse` is the post-session analysis after `Üben` or `Praxis`."
Engineer: "And `Praxis` maps to the existing rehearsal phase?"
Domain: "Yes. It is the Figma/user-facing name for the Generalprobe-style phase."
Engineer: "For validation, should we count a completed `Praxis` session as `Generalprobe`?"
Domain: "Yes. Generalprobe is the validation readout term for completed `Praxis`, not a fourth learner-facing phase."
