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
answers; leaving the entry navigator discards the in-memory draft. Saving or
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
  leaf parameters exactly once, including on cold links where a parent layout
  may not receive query parameters.
- A valid exam date resume (`step=basics`, including legacy
  `step=learningAvailability` links) reconstructs Exam type, Subject, and Date
  in native history, retaining the existing exam ID, personal subject ID, and answers.
  Incomplete resumes start at Exam type. Internal step URLs without an initialized
  draft exit safely to Home rather than showing an invalid form.
- Date continues directly to topics. The former mandatory learning-availability
  step is not reintroduced by the navigation integration.
- This does not add durable storage for an unsaved entry. Existing saved-exam
  resume links retain their contract; no backend/schema migration is involved.

Tests exercise rendered answers and actual stack state, including resume,
validation, backwards edits, fresh-draft isolation, and duplicate/failed saves.
Native recordings are required for intermediate gesture visuals and cancellation;
asserting only the final destination is insufficient.
