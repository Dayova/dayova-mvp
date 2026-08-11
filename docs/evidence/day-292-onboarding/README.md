# DAY-292 onboarding review evidence

These artifacts document the native rendering of PR #458 at commit `37e7a0e`.
They are review evidence for the accepted onboarding flow, not app assets.

## Screen recording

- `ios-onboarding-e2e-2x.mp4` is the complete visible iOS journey from the
  first educational intro through the final `Konto erstellen` step.
- Runtime: 02:28 at 2x playback; H.264, 720 x 1566, no audio.
- The recording intentionally stops before a disposable account is created.
  Verification and account creation remain covered by the automated auth
  tests and existing backend contract.

## Screenshots

- iOS light: all three intro screens, study-time input, personalized fact,
  personalized payoff, and final account-creation boundary.
- iOS dark: the first educational intro.
- Android light and dark: the first educational intro.

The canonical product decision lives in Notion and DAY-292 remains the Linear
source of truth. Future screenshots should be added only when they document a
materially different accepted state.
