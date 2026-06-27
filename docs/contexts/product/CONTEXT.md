# Product and Learning Domain Context

This context covers Dayova's product language, learning model, user journeys, content taxonomy, quizzes, study sessions, progress, and other domain concepts.

Confluence is the current cross-functional documentation hub. Keep this file focused on implementation-facing terminology and assumptions that agents need while working in this repo.

## Language

**Persönlicher Lernplan**:
The user-facing learning-plan creation flow. It frames the five short pre-plan questions and optional learning material as the setup for the learner's personalized plan.
_Avoid_: Wissensanalyse, Quiz

**Pre-plan diagnostic step**:
The internal name for the five-question diagnostic part of `Persönlicher Lernplan`, used when distinguishing it from post-session `Wissensanalyse`.
_Avoid_: User-facing copy

**Wissensanalyse**:
The post-session analysis shown after `Üben` or `Praxis`. It summarizes the learner's strengths, knowledge or execution gaps, and near-term recommendations for the ongoing plan.
_Avoid_: Using this term for the pre-plan diagnostic step in new user-facing copy

**Lernkarte**:
A theory card with a front side naming a concept, formula, or definition and a back side explaining it with details and examples.
_Avoid_: Quiz question, exercise

**Üben**:
The guided practice phase of a learning session. It mixes multiple-choice, written, and spoken tasks, then gives answer-level feedback with a rating, explanation, and ideal answer.
_Avoid_: Only drilling the learner's mistakes, single-mode quiz

**Praxis**:
The user-facing name for the rehearsal or `Generalprobe` phase. It simulates a timed test with mixed task types and leads into a `Wissensanalyse`.
_Avoid_: Treating Praxis as a fourth phase separate from rehearsal

## Notes

- Capture repo-relevant summaries or links to Confluence decisions here.
- Put product/domain ADRs in `docs/contexts/product/adr/`.

## Example Dialogue

Domain: "The learner sees this as their `Persönlicher Lernplan`, not as a diagnostic quiz."
Engineer: "So I can use `pre-plan diagnostic step` internally, but the UI copy should say things like `Beantworte 5 kurze Fragen für deinen persönlichen Lernplan`?"
Domain: "Right. `Wissensanalyse` is the post-session analysis after `Üben` or `Praxis`."
Engineer: "And `Praxis` maps to the existing rehearsal phase?"
Domain: "Yes. It is the Figma/user-facing name for the Generalprobe-style phase."
