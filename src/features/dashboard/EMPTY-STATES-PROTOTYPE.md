# Throwaway Today empty-state preview

Not for production or merging. Branch: codex/prototype-today-empty-states-20260928.
Based on the fixed-height Today implementation in #796.

Question: does the existing-plan empty state feel coherent when it reuses the
224pt notched learning card, instead of a large centered calendar illustration?

Decision brief:
- Job: explain that no next learning step is available and offer access to plans.
- Hierarchy: status title, short explanation, subordinate plans action.
- Primary action: view existing learning plans; no Play icon for absent content.
- Friction: remove the calendar illustration and large full-width CTA.
- Choice: same notched blue surface/artwork, fixed standard height and outline arrow.

The existing DashboardScreen renders preview data only in development. Default
prototype state is no-step. A prototype=new-user parameter selects the existing
new-user state; prototype=off restores live rendering. The fallback CTA is a no-op
in previews. No persisted plans or entries are modified. Other app navigation
remains real. Calendar rows are empty in both mocked scenarios.

Launch the already-running Jakob simulator app:
`xcrun simctl launch 47731F12-CE91-4857-8F3A-799040A0DCA3 de.dayova.app-dev`

Verdict: awaiting Philipp's visual feedback. This branch must not be merged.
The calendar and next-step selection logic are unchanged. Inspection found that
next-step selection excludes past-time unfinished entries; fix that separately.
