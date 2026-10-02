# DAY-187: restore the demonstrated personal-subject UI

## Compact editor actions

Philipp requested a single compact action row in the subject editor:
"Löschen" left, "Speichern" right, equal widths with 12px spacing and the
existing shared small Button size (minimum 48px touch height). Saving remains
the primary action; deletion retains its outlined danger appearance and
confirmation. Large content sizes use the existing vertical-reflow rule.
Only layout and labels change; persistence and confirmation behavior stay intact.

## Latest follow-up: always save subjects; delete from the editor

Philipp explicitly superseded the earlier creation-flow scope on 2026-10-02.
Baseline: `45a84d3e14011e2afe26476a7d083dd8f625b716`.
This change belongs only to #816; learning-times PRs #813/#817 are untouched.

- Job: create a reusable subject and manage it through the settings pencil.
- Hierarchy: name first, save/add primary, delete secondary with confirmation.
- Friction removed: no "Dauerhaft hinzufügen?" step, no "Nur diesmal verwenden".
- Decision: one shared direct-save add flow in all consumers, with existing
  typo correction, ID propagation, duplicate-submit gate and error/retry behavior.
  Existing built-ins/personal subjects are reused; other newly added names are
  saved before selection succeeds. No one-time fallback on save failure.
- Editor: "Fach bearbeiten" includes "Fach löschen". It dismisses first, then
  opens the existing confirmation using the stored subject ID/name, not an
  unsaved rename draft. Cancel does not mutate. Swipe deletion is retained.
- Existing historical one-time selections remain readable. No data migration,
  backend changes or deletion of linked exams/homework/plans is introduced.

Validation: full UI suite (84 suites / 382 tests), focused subject UI tests
(4 suites / 21 tests), TypeScript, scoped Biome/ESLint and diff check pass.
Local review confirms all add-flow consumers use the same direct-save contract;
no changes to the learning-times branches or shared sheet implementation.
Tests include direct inline persistence during a catalog
error, timetable promotion, errors/retry, duplicate submissions and editor →
dismissal → confirmation → cancel/delete. Native sheet timing and fresh visual
acceptance remain separate from mocked component tests. Earlier screenshots
below are historical and do not validate this follow-up.
No fresh native replay was performed: this worktree has no local runtime env
configured; the existing simulator/Metro serves a separate combined review
checkout. It was not repointed or presented as evidence for this working tree.
Keep draft pending fresh device acceptance.

The older descriptions below record prior decisions; their one-time/permanent
choice is superseded by this section.

## Follow-up: new-exam selection screens

User confirmed Settings is correct and requested the missing creation-flow
design in #816. Baseline: `e9630c6f44ce05c64122b2b90656157fbad2c27d`.
The continuous subject list is present in historical `cc5460b4`; Jakob's
[consistency feedback on #655](https://github.com/Dayova/dayova-mvp/pull/655#issuecomment-5820536081)
asks for the same exam-type/subject add design.

Job: choose the exam type, then its subject. Hierarchy: selectable options first,
add-option row second, continue action in the existing flow. Primary action:
select one option. Friction: remove the separate personal-subject heading and
inconsistent dot/check radio treatments. Decision: shared SelectionOptionRow for
both pickers; shared AddOptionButton and outlined cancellation in both dialogs.
Do not alter Settings, backend persistence or the one-time/permanent choice.

Newly saved selections remain visible while the catalog refreshes, without a
duplicate timetable row. One-time scope remains supporting text within the row.
The current contrast-safe `onPrimary` check color supersedes old white-check
screenshots; old arbitrary radii are not reintroduced.

Validation: 84 Jest suites / 383 tests pass. Targeted cases cover one continuous
list, persistence IDs, pending catalog replacement, common checked semantics,
custom exam cancellation and wrapping labels. TypeScript, targeted ESLint,
Biome and `git diff --check` pass.

### Native replay of the creation-flow follow-up

Code commit: `96bd672b2f6bd0c2d36b2897baba2bea7bd30b5d`. Tested on the
combined local review branch at `d2e61d1ec17a220b77f081ed7fecc32832fc7f10`
(also includes #813, #815 and #817), iOS 26.4, light appearance.
Maestro completed successfully: select Test, open the exam-type add sheet,
verify its input, cancel, continue to subject selection, verify Mathematik
and absence of the separate personal-subject heading. No exam or subject saved.

Fresh still-image evidence:

- [Exam type selected](day-187-exam-selection-2026-10-02/exam-type-after.png)
- [Add exam type with keyboard](day-187-exam-selection-2026-10-02/exam-add-after.png)
- [Subject selection](day-187-exam-selection-2026-10-02/exam-subject-after.png)

The subject screenshot shows the top of the list, not a populated personal-subject
catalog. Pending personal selections and the continuous list are additionally
covered by UI tests. These are navigation and layout checks, not fresh end-to-end
CRUD acceptance or isolated-PR device evidence. Dark mode, Android, enlarged text
and physical-device accessibility checks were not repeated for this follow-up.

## Earlier Settings restoration: decision brief

- Job: manage reusable personal subjects from Settings.
- Hierarchy: page/header add action, explanation, subject cards with rename.
- Primary action: add a subject; the existing empty-state shortcut stays.
- Friction: restore direct permanent saving in Settings, remove the always-visible
  trash icon, and make cancellation and destructive actions visually distinct.
- Decision: restore the demonstrated September design, not withdrawn PR #803.
  Keep one-time/permanent selection in creation flows and current keyboard,
  error-handling, account ownership and reference persistence behavior.

## Provenance and scope

Previous #816 head: `f5064dfaf5ac2a1e01971da9969e3e58af0f8171`.
References: `c41c628e` (swipe), `cc5460b4` (outlined cyan add control,
subject-specific icons, empty action), and the preserved subject-consumer patch
and historical screenshots in
[PR #729](https://github.com/Dayova/dayova-mvp/tree/ed7128542557e7659eadf1b68d96ed895cea09d7/docs/qa/popup-actions-2026-09-24).
Do not merge the old shared QA branch or apply its backend code.

Shared Button gains opt-in `cancel` and `destructive-outline` variants using
the reviewed #729 light/dark danger tokens. Existing destructive buttons and
confirmation defaults remain unchanged. Only the personal-subject confirmation
opts into outlined actions; no dependency on #727/#729 is introduced.
The add control uses the existing Hugeicons Plus wrapper in cyan, avoiding the
historical custom SVG. Subject icons use the existing catalog's Hugeicons mapping.

Deleting still requires confirmation. Screen readers can invoke the named delete
action on each rename control without a swipe. Swipe itself is not a mutation.
Empty/loading/error states and the separate creation-flow storage choice remain.

## Validation

- TypeScript and targeted ESLint pass; 83 Jest suites / 378 tests pass.
- Seven theme tests pass, including light/dark danger contrast at idle and
  80% pressed opacity and CSS/runtime synchronization.
- Standards review identified missing save-progress announcement; added a polite
  live region and named progressbar with a regression assertion.
- Spec review: no missing requirements or scope findings; historical custom
  gradient SVG intentionally maps to the current solid-cyan Hugeicons wrapper.
- At the earlier Settings validation, the local combined review simulator received this implementation. Opening the
  route on iOS 26.4 reached onboarding, not the authenticated subject screen.
  Native visual/keyboard/swipe acceptance is therefore still open pending login.
- Android, enlarged text and VoiceOver/TalkBack device checks remain open.

Historical images are references, not evidence for this revision. No production
deployment, account modification, subject deletion or full native approval.
