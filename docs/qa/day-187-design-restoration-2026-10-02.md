# DAY-187: restore the demonstrated personal-subject UI

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
custom exam cancellation and wrapping labels. Native replay is pending below.

## Decision brief

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
- The local combined review simulator received this implementation. Opening the
  route on iOS 26.4 reached onboarding, not the authenticated subject screen.
  Native visual/keyboard/swipe acceptance is therefore still open pending login.
- Android, enlarged text and VoiceOver/TalkBack device checks remain open.

Historical images are references, not evidence for this revision. No production
deployment, account modification, subject deletion or full native approval.
