# PR #816: Keyboard and sheet transitions

## Request and cause

Philipp reported delayed keyboard appearance/disappearance in subject dialogs.
The original recording was unavailable locally; the report was reproduced at
the native lifecycle boundary instead of claiming to have reviewed that file.
Previously autofocus ran from Gorhom's `onChange` after the sheet had opened.
Controlled and close-button dismissals did not explicitly dismiss the keyboard
before starting the sheet animation.

## Change

- The narrow `onOpening` callback fires once when the native opening animation
  begins, not after it finishes. Subject add/edit and the existing custom exam
  type input use it; keyboard-aware sheet inputs remain unchanged.
- Controlled dismissal, close controls and downward sheet animation dismiss
  the keyboard at the start. Busy/non-dismissible guards remain in place.
- No timeouts, backend changes, stored-subject changes or new UI design.

## Verification

Two lifecycle regression assertions failed before the fix and pass after it:
opening triggers input focus before native presentation completes; controlled
closing calls keyboard dismissal before the sheet's dismissal method.
Full UI suite: 387 tests / 84 suites passed, including the callback rename.
An additional drag-dismiss regression passed in the targeted 17-test frame
suite. TypeScript and scoped lint passed.

Native iOS review used the owned #816 worktree on Metro 8085, not a mutation of
the shared integration checkout. Maestro opened the add dialog, asserted the
input and Cancel, cancelled, and verified return to the overview without writes.
The edit dialog also opened and closed without saving after moving the Expo
development overlay away from its close button. The initial edit-close test
hit that overlay instead of the app button; the unobstructed rerun passed.

## Local recording evidence

Recording: `/private/tmp/dayova-keyboard-fixed.mp4`.
SHA-256: `4a0e515f7bacdbe6e6cf52ed23aa7a65eff6d74887a1eeeb9bfa647b6acdc7ea`.

Coverage: 29.78-second video; 60 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); 21 additional frames from 00:00:23.000 to 00:00:25.500 at 10 fps; no audio stream.

All full and focused sheets inspected, with individual transition frames.
23.2–23.7 s: sheet opening and keyboard appearance overlap; input is focused.
24.6–25.0 s: Cancel, keyboard and sheet descend, overview remains.
No transcription: no audio stream. Sampling does not prove frame-perfect
animation timing or physical-device performance. Unrelated existing development
notification/PostHog diagnostics were visible and are not fixed by this PR.
