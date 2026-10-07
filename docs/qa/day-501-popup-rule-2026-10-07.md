# DAY-501 — General popup and destructive-action rule

The new branch generalizes #727 on main `1fadb77b`, using the existing personal-subject and learning-time destructive/cancel appearance. The shared rule lives in [design-system context](../contexts/design-system/CONTEXT.md#general-popup-and-destructive-action-rule) and [sheet guidance](../bottom-sheets.md).

## Scope audit

`DayovaSheetFrame` is the only production `BottomSheetModal` renderer. A source audit found 27 production files using that frame or its `ActionSheet`, `SelectSheet`, and `ConfirmationSheet` wrappers. Coverage includes creation/source selection, subjects, learning times, learning plans/materials, timetable, entry editing, profile/account, subscription management, notifications, analytics, privacy/AI consent, support, release notes, onboarding selection, and date/time pickers. The common frame change reaches all these callers; this is not a claim that every individual route was visually exercised.

Text delete actions now share semantic danger tokens, including entry deletion, session removal, profile account deletion and subscription-management account deletion. Existing subject/time outlined variants remain compatible. Compact swipe-trash rails and inline remove controls remain compact; native OS chrome remains platform-owned. No deletion, upload, auth or backend logic changed.

## Validation

- Complete UI suite: 88 suites, 450 tests passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint for changed TypeScript files and Biome checks: passed.
- Theme CSS and selection-contrast suites: 8 tests passed.
- Independent Standards and Spec reviews: initial documentation/spacing findings corrected in `607e9ba3`; both rechecks report no remaining findings.
- Native screenshots: existing iOS 26.4 iPhone simulator, actual shared components rendered in a temporary isolated gallery with no backend mutations. The gallery is not shipped. Normal delete/cancel, primary/cancel, and dark error states were exercised; cancel dismissal succeeded. These are component render proofs, not end-to-end account or data-deletion tests.
- Android runtime inspection was unavailable in this environment; no Android visual certification is claimed. Screen-reader focus/keyboard/dismissal coverage is automated, not a live VoiceOver certification.

## Native evidence

### Delete / cancel — light

![Equal-width outlined cancel and destructive actions](assets/day-501/delete-light.png)

### Error — dark

![Error remains visible with themed destructive action](assets/day-501/delete-dark-error.png)

### Maximum Dynamic Type — reachable actions

At `accessibility-extra-extra-extra-large`, the description scrolls and actions stack. All action text remains present (including a wrapped Cancel label); Maestro scrolled to the actions and successfully dismissed through Cancel. The simulator was restored to its original `large` content size afterward.

![Scrolled actions at maximum Dynamic Type](assets/day-501/large-text-actions.png)

### Primary action remains primary

![Save retains its gradient beside outlined Cancel](assets/day-501/primary-light.png)
