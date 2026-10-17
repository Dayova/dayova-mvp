# Select the entered topic directly — 17 October 2026

Follow-up to PR #884 at `d95d6877`, explicitly requested by Jakob. Missing
catalog topics must not require retyping into a different field.

## Decision brief

- **Job:** capture the learner's actual exam topics in one place, including
  wording the catalog does not contain.
- **Hierarchy:** topic input → selectable entered title → catalog alternatives
  → persistent chosen titles → optional exam instructions.
- **Primary action:** select a topic with the existing checkbox control; Weiter
  still advances only when the existing exam-scope validation succeeds.
- **Friction:** eliminate retyping missing terms and waiting for the provider
  before choosing the entered term.
- **Chosen decision:** show one stable selectable entered-title row immediately
  below the input. Merge an exact normalized catalog title into that row. Keep
  the learner's chosen spelling and notes unchanged if a response arrives later.

## Contract and limits

Own topics use the existing learning-plan `topicItems` array and removable chips.
They are ordinary titles in the full saved exam scope, including its calendar
and material/AI projection; they do not create global catalog/provider records.
No new backend field, table, analytics event, provider call or dependency.

The row is independent of the three-character minimum, 100-character catalog
limit, 120 ms debounce, network and empty/error outcomes. Whitespace alone has
no row. No silent truncation: a longer title can be selected in full. Selecting
a title does not bypass the existing meaningful-scope validation. Saving/loading
disables input, own choice, catalog choices and removal together.

Compare complete titles with existing NFKC/case/whitespace normalization. An
exact catalog match occupies the entered-title row instead of being duplicated
below it. A late response may add context but never rewrite a saved selection.
Keep up to five other catalog alternatives; all chosen titles remain visible
as chips even when input clears or changes. Selecting does not clear the query,
so the checked row stays visible and reversible like existing catalog choices.

The independent textarea is now **Hinweise zur Prüfung (optional)**, with
examples OHiMi/ohne Hilfsmittel, ohne Taschenrechner and Lösungsweg angeben.
It remains free text: legacy full lists and other special instructions stay
readable/editable, and no content is reclassified or migrated. Changed copy
routes missing topics to the immediate row instead of requiring entry below.

The canonical [decision record](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a)
and [Julius' DAY-517](https://linear.app/dayova/issue/DAY-517) retain #884 as the
preferred validation template; student benefit remains unvalidated.

## Validation

Four new rendered regressions failed before implementation: immediate own
selection during failure, normalized late-catalog deduplication, full own titles
beyond the catalog limit, and short/blank/disabled states. An additional creation
route regression selects an own title, verifies the save payload and restores
the separate chip and note from the saved snapshot. Existing removal, caching,
stale-subject, save/pause and legacy-input checks remain active. Test, review,
native media and current-head CI outcomes are recorded in the PR, with their
actual revision and platform scope.

Complete local suite: **139 Vitest files / 1,117 tests**, **18 additional Node
tests**, **102 Jest suites / 549 UI tests**, all passed. The first parallel
verification/build run hit seven existing five-second timeouts in unchanged
OTA and diagnostic tests. After reducing concurrent work, the complete rerun
with `VITEST_MAX_WORKERS=1` passed (Vitest 191.29 s; Jest 162.714 s). No timeout,
assertion, skip, lockfile or repository configuration was weakened. pnpm used
the same command-only dependency-verification override documented in earlier
QA; no reinstall of the shared dependencies used by the Pixel preview.

Full lint/TypeScript and CodeRabbit over the nine changed files passed, with
zero findings. After native inspection, the selected empty-state message was
changed to “Keine weiteren Katalogvorschläge.” so it does not ask the learner
to select an already chosen own title again. All 20 rendered search tests passed
again after that final copy change; current-head CI checks the complete revision.

The focused native run uses the dedicated Android 16/API 36 emulator and a
synthetic Clerk account against the live development backend, with the existing
separate #891 startup fix in its preview. It demonstrates a real zero-result
term, own selection, intact notes, material/save/back restoration and exact
catalog-result reuse. New raw screenshots and the complete-timeline-inspected
recording are attached to the PR with source/copy scope. No iOS runtime or new
comprehensive screen-reader acceptance is inferred from this Android run.
