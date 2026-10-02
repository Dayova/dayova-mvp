# DAY-187: restore the demonstrated personal-subject UI

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

Pending final automated checks and native inspection. Historical images are
references, not evidence for this revision. No backend deployment is required.
