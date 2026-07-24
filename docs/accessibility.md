# Accessibility contract

Dayova treats semantic accessibility as a separate quality axis from visual
content-size resilience. A screen is not complete merely because it remains
usable at a large font scale.

## Authentication

- Every custom action has a native accessibility role, a meaningful German
  label, and disabled, checked, selected, expanded, or busy state where
  applicable.
- Icon-only controls keep at least a 44-point effective target. Password fields
  use `PasswordVisibilityButton`; the icon describes the current visibility
  state and the label describes the action.
- The six visual verification-code cells are decorative. Assistive technology
  receives one full-size, labelled six-digit input instead of six unrelated
  cells or an invisible one-pixel target.
- Choice chips and goals expose checkbox state. Selection sheets expose radio
  state. Progress indicators expose a numeric progress value.

## Errors and status changes

- User-facing inline errors use `ErrorMessage` or `FieldMessage`. Both expose an
  alert role, a polite live region, selectable text, and the destructive visual
  treatment.
- `InsetTextField` repeats its validation message in the field hint, so the
  relationship remains available after the live announcement has finished.
- Dynamic warning banners are polite live regions. Error banners additionally
  receive the alert role at their call site; informational banners do not
  interrupt the user as errors.
- Bespoke auth animations that cannot use the shared text primitive must still
  provide the same alert and live-region semantics.

## Bottom sheets

All app-owned sheets go through `DayovaSheetFrame` or a specialized wrapper.
The frame:

- marks the sheet content as modal;
- hides the underlying navigator from VoiceOver and TalkBack while the sheet is
  actually presented;
- moves accessibility focus to a labelled sheet heading after presentation;
- supports the VoiceOver escape gesture and an explicit accessibility escape
  action when the sheet is dismissible;
- keeps the visual backdrop out of the accessibility tree because every sheet
  has an explicit close or completion control; and
- can restore focus to a supplied `returnFocusRef` after native dismissal.

The sheet's controlled lifecycle remains authoritative. Accessibility state is
updated from native `onChange` and `onDismiss`, not merely from the requested
`visible` prop, so closing animations and close/reopen races do not expose the
background early.

## Verification

- Component tests assert auth control names and roles, live error behavior,
  field/error association, sheet modal semantics, focus movement, escape, and
  background hiding.
- Manual release QA still covers TalkBack on Android and VoiceOver on iOS:
  traverse each auth stage, trigger one validation and one server error, open
  each sheet type, dismiss by its close control and escape gesture, and verify
  focus returns to a sensible position.
- Large text and display-size resilience is tracked separately in
  [GitHub PR #271](https://github.com/Dayova/dayova-mvp/pull/271). Its
  simulator/emulator matrix complements these semantics; physical
  iOS and Android assistive-technology passes remain required before release.
