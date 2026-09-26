---
status: accepted
---

# Entry steps use native history

The exam form previously changed a local step while remaining one native screen.
On iOS, an edge swipe therefore targeted Home behind the entire form. Preventing
removal could repair the settled destination but could not give the gesture the
correct preceding screen to reveal.

Each full-screen exam and homework step now occupies a route in `entry/new`'s
native stack. Route history is the only current-step state. Ordinary header,
iOS edge, and Android system Back consume that history. Sheets consume Back
before navigation; an in-flight save prevents leaving until it succeeds or fails.
Native transitions replace the form's redundant content fade.

## Draft lifetime and navigator ownership

`EntryDraftProvider` belongs to the entry layout. It owns answers, the saved exam
identity, and the shared synchronous mutation gate. Popping a step preserves
answers; a second entry URL starts a clean request even when the layout remains
mounted. Leaving the entry navigator also discards the in-memory draft. Saving or
continuing to topics replaces the entire entry navigator, removing its completed
steps from Back history.

This uses a nested stack rather than onboarding ADR 0003's existing-stack option.
The entry flow already has external destinations and resume URLs; its layout is
the lifetime boundary needed to clear a discarded or completed draft without
sharing stale answers with the next entry. The existing creation progress shell
remains outside that stack. Verification must include root-step exit through the
parent navigator as well as internal gestures and gesture cancellation.

## Entry, resume, and learning times

- `/entry/new` remains the public entry and resume URL. Initialization reads its
  leaf parameters on each new route request, including on cold links where a
  parent layout may not receive query parameters. Returning to the same first
  step through native Back keeps the draft. A new request clears the old answers
  and saved exam ID, then resets the nested history to its proper first step.
  An older save that finishes after a new request cannot redirect or attach its
  exam ID to the new draft.
- A valid exam availability resume reconstructs Exam type, Subject, Date, and
  Availability in native history, retaining the existing exam ID and answers.
  It requires a saved exam ID, subject, exam type, canonical day key, and bounded
  integer duration. Incomplete resumes start a clean flow at Exam type without
  retaining the saved ID, so a fallback value cannot overwrite that exam.
  On a cold link, initialize the draft from the leaf URL first; reset the
  nested stack only after that navigator is focused. A reset during the same
  layout effect as initialization can be lost, leaving the learner at Exam type
  with prefilled answers but no predecessor history.
  Internal step URLs without an initialized draft exit safely to Home rather
  than showing an invalid form.
- Learning-time settings are pushed outside the entry stack. Their visible Back
  dismisses to the existing availability route, just as native Back does. The
  retained provider preserves answers and predecessor history.
- This does not add durable storage for an unsaved entry. Existing saved-exam
  resume links retain their contract; no backend/schema migration is involved.

Tests exercise rendered answers and actual stack state, including resume,
validation, backwards edits, re-entry while the layout is retained, fresh-draft
isolation, and duplicate/failed saves.
Native recordings are required for intermediate gesture visuals and cancellation;
asserting only the final destination is insufficient.
