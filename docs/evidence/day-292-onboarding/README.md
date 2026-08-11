# DAY-292 onboarding review evidence

These artifacts and linked Linear attachments document the native rendering of
PR #458. They are review evidence for the accepted onboarding flow, not app
assets.

## Screen recording

- `ios-onboarding-e2e-2x.mp4` records the visible iOS journey from the first
  educational intro through the final, still-empty `Konto erstellen` step.
- Runtime: 02:28 at 2x playback; H.264, 720 x 1566, no audio.
- Full-timeline sampling coverage: **Coverage: 148.30-second video; 80
  full-timeline frames sampled at 0.539447 fps (1.85375-second interval); 5
  contact sheet(s); no audio stream.**
- Timestamped observations from that complete-timeline pass:
  - `00:00–00:14`: all three educational intro pages.
  - `00:14–00:22`: name and daily study-time input.
  - `00:22–00:37`: manual learning fact, blocker, and goal.
  - `00:37–00:42`: personalized payoff using the entered answers.
  - `00:42–01:23`: grade, federal state, and bounded school type.
  - `01:23–02:11`: birth year, month, and day as separate selections.
  - `02:11–02:17`: email input.
  - `02:17–02:28`: empty password screen and disabled-looking requirement;
    the account-creation action is not submitted.
- The recording does **not** demonstrate account creation, email verification,
  trial activation, the first empty-home action, dark mode, Android, reduced
  motion, or a second device size. Those require separate evidence; automated
  tests are supporting evidence but do not turn these runtime states into
  recorded observations.

### Fresh dark-mode follow-up

- [iOS Intro 3 screenshot](https://uploads.linear.app/25636614-9b48-4853-ae2c-f1d96a015b4e/619e3bf0-cf7d-4f0b-80eb-0007640211c0/a57a5f18-ee45-453d-85c2-4b3a609fe958)
  and [7.93-second recording](https://uploads.linear.app/25636614-9b48-4853-ae2c-f1d96a015b4e/56d07bc4-d7ed-40ef-be11-2ccccaf2fd5b/984485cb-6446-4362-a41e-8d10e31835d3)
  verify the theme-aware Intro 3 path/fade and centered CTA. Coverage: 16
  full-timeline frames at 2 fps, one contact sheet, no audio.
- [Android Intro 3 screenshot](https://uploads.linear.app/25636614-9b48-4853-ae2c-f1d96a015b4e/752bac08-51ba-4b9e-ad63-9367f88b9361/8765aee5-0e6e-48d8-b016-7f8f91a9751d)
  verifies the same theme-aware path/fade and centered CTA on a Pixel 9
  emulator.
- [Android auth-to-Intro-1 recording](https://uploads.linear.app/25636614-9b48-4853-ae2c-f1d96a015b4e/7f61b475-6a6d-446a-942e-ee03cfce5b32/1345e43f-3aa6-4062-ad45-123f2831cc10)
  covers auth at `00:00–00:07` and Intro 1 at `00:07.5–00:09.42`. Coverage:
  19 full-timeline frames at 2 fps, two contact sheets, no audio. It does not
  evidence Intro 2 or Intro 3.

## Screenshots

- iOS light: all three intro screens, study-time input, personalized fact,
  personalized payoff, and final account-creation boundary.
- iOS dark: the first and third educational intros.
- Android light: the first educational intro.
- Android dark: the auth choice and first and third educational intros.

The canonical product decision lives in Notion and DAY-292 remains the Linear
source of truth. Future screenshots should be added only when they document a
materially different accepted state.
