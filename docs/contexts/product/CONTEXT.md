# Product and Learning Domain Context

This context covers Dayova's product language, learning model, user journeys, content taxonomy, quizzes, study sessions, progress, and other domain concepts.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

Canonical product framing: [Dayova Business Plan 2026 — Exact Exam, Real Gaps, Next Step](https://app.notion.com/p/Dayova-Business-Plan-2026-Exact-Exam-Real-Gaps-Next-Step-3ac2e87228bf81efa709e901f684da0d)

## Language

**Persönlicher Lernplan**:
The user-facing learning-plan creation flow and accepted study path. It frames five short pre-plan questions, extended up to eight when scope or readiness remains unclear, and optional learning material as the setup for a personalized, ordered plan whose sessions build toward exam readiness.
_Avoid_: Wissensanalyse, Quiz

**Interne Schulquelle**:
A teacher instruction, exam-scope statement, worksheet, class note, or other material that came from school. At least one internal school source or concrete teacher instruction is required before Dayova derives the probable exam scope.
_Avoid_: Treating Dayova or a generic curriculum as the source of truth

**Externe Lernhilfe**:
Optional supporting material from sources such as explanatory videos, learning platforms, or AI tools. It may improve explanations and practice but never expands the probable exam scope beyond the internal school evidence.
_Avoid_: Using external material to decide what the teacher will assess

**Bestätigter Prüfungsumfang**:
The short topic map Dayova derives from internal school evidence and asks the learner to confirm before the pre-plan diagnostic step. Confirmation means that the evidence was interpreted plausibly, not that Dayova guarantees the teacher's exact exam content.
_Avoid_: Manual classification of every uploaded page, exact-exam guarantee

**Nächster Lernschritt**:
The next unfinished session in a `Persönlicher Lernplan`. It is the only session whose detailed learning content must be committed up front; later sessions remain a provisional roadmap and receive their detailed content when they become next.
_Avoid_: Hard lock, hidden future sessions

**Lernzeit**:
A recurring availability window chosen by the learner in Einstellungen that tells Dayova when learning may be scheduled. It is not itself a scheduled session or learning content.
_Avoid_: Lernsession, Lernblock, automatically invented availability

**Stundenplan**:
The learner-verified recurring weekly school schedule. It is the source of truth for school occupancy and is not expanded into months of one-off day entries.
_Avoid_: Tagesplan, Lernzeit, imported calendar

**Unterrichtsstunde**:
A recurring subject and time interval within a `Stundenplan`.
_Avoid_: Lernsession, Aufgabe, materialized daily appointment

**Unterrichtstermin**:
A dated, read-only occurrence derived from an active `Unterrichtsstunde` for display and scheduling conflict checks.
_Avoid_: Persisted `dayEntry`, completable task

**Lernsession**:
A scheduled learning appointment inside one `Lernzeit`, with a concrete start, planned duration, and learning goal. A session may contain multiple `Lernblöcke` without turning them into separate calendar appointments.
_Avoid_: Lernzeit, treating each content phase as a separate appointment

**Lernblock**:
A contiguous theory, `Üben`, or `Praxis` segment within one `Lernsession`. Its duration is part of the session's content budget, not a requirement to repeat completed material until a timer expires.
_Avoid_: Separate calendar slot, repeated filler

**Weiterlernen**:
An optional learner-initiated extension offered after the planned work of a `Lernsession` is complete. It adds new work and never repeats finished material merely to consume time.
_Avoid_: Automatic overtime, timer padding

**Pre-plan diagnostic step**:
The internal name for the adaptive five- to eight-question diagnostic part of `Persönlicher Lernplan`, used when distinguishing it from post-session `Wissensanalyse`.
_Avoid_: User-facing copy

**Topic readiness**:
An evidence-based estimate of whether the learner's knowledge of one required assessment topic is secure, developing, uncertain, or unknown. It combines demonstrated performance with self-reported confidence and shapes the topic's theory, practice, and later verification.
_Avoid_: Treating confidence alone as mastery, one overall score for the entire assessment

**Unsicher**:
The user-facing `Topic readiness` state for a concrete weakness shown by the learner's latest graded answer. Missing evidence alone never makes a topic uncertain, and evidence that contradicts an earlier secure pattern remains `Im Aufbau` until a `Kontrollbeleg` resolves it.
_Avoid_: Schlecht, nicht gelernt, using the state for untested knowledge

**Belegdimension**:
One of the exam-specific capabilities Dayova evaluates for a topic: `Verstehen`, `Probleme lösen`, or `Selbstständig lösen`. These are evidence axes, not sequential content phases or point categories.
_Avoid_: Lernphase, Punktebereich, treating the three dimensions as interchangeable

**Kontrollbeleg**:
A fresh, relevant answer requested when new performance contradicts previously secure evidence. The contradiction moves the affected topic to `Im Aufbau` while preserving its history; it never erases existing evidence into `Noch nicht belegt`.
_Avoid_: Reset, punishment, treating one contradiction as no prior knowledge

**Preparation gap**:
The difference between the preparation Dayova recommends for the assessment and the learning time available before it. A plan with a preparation gap prioritizes the strongest feasible coverage without presenting that reduced plan as complete readiness.
_Avoid_: Inventing availability, silently treating reduced coverage as fully recommended preparation

**Preparation depth**:
The internal intensity of a `Persönlicher Lernplan`: compact, thorough, or intensive. Assessment type supplies a deterministic default, while `Topic readiness` and available learning time determine the feasible preparation. It is not a mandatory learner choice in the creation flow.
_Avoid_: Fixed session count based only on the assessment label, an extra workload-choice screen, AI-selected intensity

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
The user-facing name for the rehearsal or `Generalprobe` phase. It creates an authentic but compressed 20- to 30-minute test situation with mixed task types and leads into a `Wissensanalyse`; important assessments prefer multiple short Praxis sessions over one full-duration simulation.
_Avoid_: Treating Praxis as a fourth phase separate from rehearsal, requiring one Praxis to match the full assessment duration

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

- Capture concise implementation-relevant summaries and links to canonical Notion decisions here.
- Put product/domain ADRs in `docs/contexts/product/adr/`.

## Contracts and Constraints

- Uploaded timetable data remains a draft until the learner reviews and activates at least one valid `Unterrichtsstunde`.
- Only the active `Stundenplan` produces `Unterrichtstermine`; drafts never affect the daily agenda or learning-plan scheduling.
- `Unterrichtstermine` block overlapping learning appointments but remain informational and cannot be completed.
- The post-session Analyse surface uses the user-facing states `Sicher belegt`, `Im Aufbau`, `Unsicher`, and `Noch nicht belegt`. `Unsicher` requires a recent incorrect or partially correct graded answer; missing evidence is never presented as a demonstrated weakness. Pre-plan `topicReadiness` remains the stored three-state diagnostic estimate (`secure`, `developing`, `unknown`).
- An assessment topic is `Sicher belegt` only when every `Belegdimension` required by that topic is secure. New topic maps declare the required dimensions; legacy topics conservatively require all three.
- Evidence is hierarchical: independent exam-like performance may support `Probleme lösen` and `Verstehen`, and guided problem solving may support `Verstehen`; lower-strength evidence never proves a higher dimension.
- The Analyse overview may count secure topics but must not collapse readiness into a global percentage or points score. Activity or completed theory review alone never proves secure knowledge.

## Example Dialogue

Domain: "The learner sees this as their `Persönlicher Lernplan`, not as a diagnostic quiz."
Engineer: "So I can use `pre-plan diagnostic step` internally, but the UI copy should say things like `Beantworte 5 kurze Fragen für deinen persönlichen Lernplan`?"
Domain: "Right. `Wissensanalyse` is the post-session analysis after `Üben` or `Praxis`."
Engineer: "And `Praxis` maps to the existing rehearsal phase?"
Domain: "Yes. It is the Figma/user-facing name for the Generalprobe-style phase."
Engineer: "For validation, should we count a completed `Praxis` session as `Generalprobe`?"
Domain: "Yes. Generalprobe is the validation readout term for completed `Praxis`, not a fourth learner-facing phase."
