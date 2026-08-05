# Product and Learning Domain Context

This context covers Dayova's product language, learning model, user journeys, content taxonomy, quizzes, study sessions, progress, and other domain concepts.

Notion is Dayova's main internal documentation and knowledge workspace. Keep this file focused on implementation-facing terminology and assumptions that must evolve with the code, and link to relevant Notion records instead of duplicating shared documentation.

Canonical product framing: [Dayova Business Plan 2026 — Exact Exam, Real Gaps, Next Step](https://app.notion.com/p/Dayova-Business-Plan-2026-Exact-Exam-Real-Gaps-Next-Step-3ac2e87228bf81efa709e901f684da0d)

## Language

**Persönlicher Lernplan**:
The user-facing adaptive study path created after the learner uploads at least one `Interne Schulquelle`. Creation schedules a `Wissenscheck` and a rolling two-session future window instead of asking setup questions or generating the complete plan up front.
_Avoid_: Wissensanalyse, setup quiz, fully generated schedule

**Interne Schulquelle**:
A teacher instruction, exam-scope statement, worksheet, class note, or other uploaded material that came from school. An exam may exist without it, but at least one uploaded internal school source is required for a `Persönlicher Lernplan`; typed teacher guidance alone is not a substitute.
_Avoid_: Treating Dayova or a generic curriculum as the source of truth

**Externe Lernhilfe**:
Optional supporting material from sources such as explanatory videos, learning platforms, or AI tools. It may improve explanations and practice but never expands the probable exam scope beyond the internal school evidence.
_Avoid_: Using external material to decide what the teacher will assess

**Bestätigter Prüfungsumfang**:
The short topic map Dayova derives from internal school evidence and asks the learner to confirm before creating the plan. Confirmation means that the evidence was interpreted plausibly, not that Dayova guarantees the teacher's exact exam content; initial knowledge evidence is collected later in the scheduled `Wissenscheck`.
_Avoid_: Manual classification of every uploaded page, exact-exam guarantee

**Nächster Lernschritt**:
The next unfinished committed, timed session in a `Persönlicher Lernplan`. The learner also sees one dated and timed provisional session after it; that preview has no generated learning content until the preceding session is complete, and its target may change when new evidence arrives.
_Avoid_: Hard lock, hidden future sessions, fixed full-plan roadmap

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

**Wissenscheck**:
The first timed `Lernsession` in every `Persönlicher Lernplan`, containing five to ten questions that test existing knowledge across the confirmed exam scope. Its results seed adaptive target selection; it is neither a creation/setup step nor a `Wissensanalyse`.
_Avoid_: Setup quiz, pre-plan diagnostic, Wissensanalyse

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
_Avoid_: Using this term for the first `Wissenscheck` or for questions during exam creation

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

- Saving an exam is independent from creating a `Persönlicher Lernplan`. Without uploaded school material, keep the exam and explain that uploading an `Interne Schulquelle` unlocks a plan; do not create plan sessions.
- External learning aids and typed teacher guidance may enrich a plan but never satisfy the school-material requirement.
- Learning-plan creation contains no knowledge-question or quiz step. Its first knowledge test is the scheduled, timed `Wissenscheck` with five to ten questions.
- An active `Persönlicher Lernplan` always exposes two future sessions with a date and start time: the committed `Nächster Lernschritt` and one provisional adaptive preview. It never materializes the complete remaining plan.
- Completing the committed session promotes and adapts the provisional session from the latest evidence, then appends a new timed provisional session so two future sessions remain visible.
- Uploaded timetable data remains a draft until the learner reviews and activates at least one valid `Unterrichtsstunde`.
- Only the active `Stundenplan` produces `Unterrichtstermine`; drafts never affect the daily agenda or learning-plan scheduling.
- `Unterrichtstermine` block overlapping learning appointments but remain informational and cannot be completed.
- The post-session Analyse surface uses the user-facing states `Sicher belegt`, `Im Aufbau`, `Unsicher`, and `Noch nicht belegt`. `Unsicher` requires a recent incorrect or partially correct graded answer; missing evidence is never presented as a demonstrated weakness, and initial readiness comes from the first timed `Wissenscheck`, not setup input.
- An assessment topic is `Sicher belegt` only when every `Belegdimension` required by that topic is secure. New topic maps declare the required dimensions; legacy topics conservatively require all three.
- Evidence is hierarchical: independent exam-like performance may support `Probleme lösen` and `Verstehen`, and guided problem solving may support `Verstehen`; lower-strength evidence never proves a higher dimension.
- The Analyse overview may count secure topics but must not collapse readiness into a global percentage or points score. Activity or completed theory review alone never proves secure knowledge.

## Example Dialogue

Domain: "An exam can be saved without material, but it has no learning plan yet."
Engineer: "So saving stays available, while plan creation asks for school material and contains no setup quiz?"
Domain: "Right. The first five to ten knowledge questions are the timed `Wissenscheck` inside the plan."
Engineer: "And after each completion we keep two dated future sessions visible, with the second still adaptive?"
Domain: "Yes. Promote and adapt the preview from the latest evidence, then append the next provisional session."
Engineer: "And `Praxis` maps to the existing rehearsal phase?"
Domain: "Yes. It is the Figma/user-facing name for the Generalprobe-style phase."
Engineer: "For validation, should we count a completed `Praxis` session as `Generalprobe`?"
Domain: "Yes. Generalprobe is the validation readout term for completed `Praxis`, not a fourth learner-facing phase."
