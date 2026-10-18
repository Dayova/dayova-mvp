# Learning-time settings design restoration — PR #817

## Independent design PR — 03.10.2026

Philipp requested delivery of #817 independently of the ongoing #813 redesign.
The design-only delta from `ea0735a1..fc30a7ee` was applied to `main` at
`0f15a796`, excluding the inherited onboarding commit. Shared definitions from
merged #816 are reused; the sheet-frame conflict preserves both its keyboard
and opening behavior and #817's optional dismissal duration. Learning-time
settings source is unchanged from `fc30a7ee`.

Validation of this independent candidate: TypeScript, scoped ESLint/Biome and
staged whitespace checks passed; all 86 UI suites / 402 tests passed. Separate
standards and scope reviews found no actionable integration defects. Backend,
onboarding and planning files have no diff against `main`. Previous native
recordings below document the earlier UI; no new device run is claimed here.
The historical stack statements below are superseded by this independence decision.

## Philipp's submitted visual evidence

Six original iOS light-mode screenshots from 02.10.2026 are now included in
[the evidence gallery](../evidence/pr-817-learning-times/README.md): add sheet,
one/two-entry lists, exposed swipe action, Settings, and final delete confirmation
with the short “Löschen” label. Philipp reports his manual walkthrough works.
These still images document visible states, not continuous interactions or
confirmed persistence/deletion. They supersede earlier notes that no submitted
current UI images exist; other platform/accessibility acceptance remains open.

## Follow-up: single-row weekdays and add actions

Philipp requested all seven weekday shortcuts on one line, selected with the
existing primary-interactive blue gradient and white text, and Cancel/Add beside
each other at the standard 56px button height. Job and primary action remain
unchanged; the compact week strip removes the orphan Sunday row. It scrolls
horizontally only when its seven minimum-44px targets exceed the available width.
Text keeps system scaling; buttons retain the shared 56px minimum and may grow
for accessibility text. The add action uses the shorter label “Hinzufügen”.
No data, validation or stack changes. This supersedes the earlier stacked add
actions and solid selected-day treatment.

Verification: 11 learning-time tests, TypeScript, scoped ESLint and diff check
passed. Fresh iOS light-mode screenshot inspected after loading this change:
all seven days visible on one line, selected Tuesday has gradient/white label,
Cancel and Add aligned at standard height. This is still-image evidence, not
a new end-to-end save/delete or Android/accessibility pass.

## Latest chat follow-up: editor like personal subjects

The following supersedes the full-screen editor references below. Reference:
PR #816 at `72764a08`; implementation comparison baseline: `c20ad335`.

Decision brief:
- Job: manage recurring weekly availability from Settings.
- Hierarchy: selected weekday, start/end window, save action.
- Primary action: Save, in the existing 56px default button style.
- Friction: avoid pushing a separate editor route for a small edit.
- Decision: open the shared Dayova sheet over the existing list. In edit mode,
  outlined Delete and primary Save sit beside each other with standard height
  and a gap; large system text stacks them. Add mode has Add and Cancel.

The pencil opens the editor sheet; delete first dismisses that sheet, then opens
confirmation for the persisted entry, never an unsaved draft. Closing/cancelling
returns to the list. Saving an unchanged entry simply closes the editor.
Legacy editor links still display this same list and sheet. Existing weekday,
start/end validation and mutations are retained; #813 is not modified.

Shared Button/ConfirmationSheet opt-ins are identical to #816, including the
outlined destructive busy indicator. Defaults for other consumers are unchanged.
When integrating both PRs, retain these definitions once, not twice. A local
integration merge initially duplicated shared declarations; those were reconciled
and the combined checkout passed TypeScript.

Validation for this follow-up:
- TypeScript, scoped ESLint, formatting and diff whitespace checks passed.
- Full Jest rerun: 80 suites / 365 tests passed. The first process exited 139
  without a failing test; the complete rerun exited 0.
- Tests exercise in-place add/cancel, unchanged save and return target, waiting
  for native dismissal before delete confirmation, persisted-entry deletion,
  and save error/retry with an existing 4.5-hour window.
- Local code review: no backend/onboarding changes; retained auth/loading/busy
  guards, existing mutation gate, and invalid-time prevention.
- UI commit loaded into the existing combined iOS review checkout. Actual
  settings inspection is blocked by its logged-out session. No fresh editor
  screenshot or native interaction pass is claimed. Android, large text and
  assistive-technology acceptance remain outstanding. PR stays draft.

The earlier evidence and verification below apply to the previous correction,
not to native acceptance of the new sheet.

## Request and references

Philipp requested restoration of the previously agreed settings design, matching
personal subjects, rather than another redesign. Onboarding PR #813 remains a
separate scope; its three inputs (duration, weekdays, preferred start) stay.

- Historical design: `b9445e38`, following `aa7d317f` (weekday badges, pencil,
  swipe deletion, rounded text action).
- Current subject-management reference: PR #816 at `96bd672b`.
- PRs #802/#803 were withdrawn and are not the target design.
- Product context: [Lernzeiten meeting](https://app.notion.com/p/3ed2e87228bf8080b7bfea236d46efd6).
- Review policy: [team review guidance](https://app.notion.com/p/3dc2e87228bf81c69e43cadf318c2d9f).

## Correction from previous #817 head

Comparison baseline: `b3103aa64b5b02e1b5450421a0489d77c7494dae`.

- Restore muted Mo/Di/etc. badges instead of cyan clocks on populated cards.
- Keep only the pencil visible. Swiping exposes the rounded text-only delete
  action; it closes before the existing confirmation opens. Screen-reader
  custom actions offer deletion without swiping. Disabled state blocks both.
- Use cyan header plus and a full-width empty-state CTA without an inline plus.
- Remove the added Surface around the editor fields; restore 24px time-field
  corners. Keep adaptive layout, shared CloseButton and safe-area handling.
- Reuse #816's exact `destructive-outline` variant and light/dark danger tokens.
  These additive shared definitions overlap #816 intentionally; reconcile once
  when merging. Existing global button appearances are unchanged.
- No historical default-window/preference-status logic is restored. No backend,
  schema, onboarding, planner or notification behavior is changed by this fix.

## Scope boundary for discussion

| PR | Included | Not included |
| --- | --- | --- |
| #813 | Onboarding duration choices, explicit >4h duration, weekday/start explanations, summary/navigation, matching outbox and backend duration validation | Settings redesign, new planner algorithm |
| #817 | Settings overview, add/edit/delete UI, confirmation and failure states, existing time-window editing | Onboarding questions, backend rules, notifications, rescheduling algorithm |

PR #817 now targets `main` independently of #813, as requested by Philipp on
03.10.2026. Only the settings design changes are retained; the inherited
onboarding commit is excluded. Shared Button, ConfirmationSheet and theme
definitions already merged in #816 are reused. The sheet frame retains #816's
keyboard/opening behavior alongside #817's optional dismissal duration.
Settings use the existing `learningTimes` API on `main`, whose time-window
validation already permits windows longer than four hours. No onboarding,
backend, schema, notification or planning changes are included. Existing time
windows still require end after start on the same day.

## Verification and limits

- TypeScript `tsc --noEmit`: passed.
- Scoped Biome and ESLint: passed.
- Full Jest UI suite: 80 suites / 363 tests passed.
- Theme CSS and class-merging regression tests: 2 files / 8 tests passed.
- Local diff review: restoration stays in settings and additive shared tokens;
  no backend or onboarding code is modified. `git diff --check` passes.

Rendered tests cover ordering, weekday labels, hidden delete affordance,
action reveal through a mock seam, closing before deletion callback, edit/add
navigation, authentication/loading gates, accessible deletion, confirmation,
cancellation, duplicate-submit protection and retry. A 4.5-hour entry is kept.
The mocked reveal is not evidence of a native swipe gesture.

Fresh native before/after evidence for this corrected head is still required:
iOS and Android, light/dark, empty/populated, editor, real swipe, large system
text and screen reader. Previous #817 screenshots predate this correction and
must not be presented as current-head evidence. Keep the PR draft until that
visual acceptance is complete. No production deployment or merge is performed.

Device inventory: two iOS simulators are running for the separate subject and
onboarding tasks; their app sessions were not repointed to this worktree.
`adb` is not available on this shell's PATH. Neither platform was freshly
visually inspected for this correction; component tests are not a substitute.
