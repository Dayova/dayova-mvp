# Auth swipe isolation

Source: user-supplied `ScreenRecording_10-05-2026 02-08-20_1.MP4` (5 October 2026).

## Before observations

- 00:00–00:04.5: auth choice followed by the four introduction pages.
- 00:05–00:06.5: the introduction slides right and exposes the settings tab underneath (profile, support, learning times, personal subjects).
- 00:08.5–00:09: settings appears again while leaving the material introduction page.
- 00:13: settings also appears underneath the auth choice.

Coverage: 16.99-second video; 34 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); audio stream detected; transcription not performed.

All three full-timeline contact sheets and the 00:05.5 individual frame inspected. Audio present, not transcribed; observations are visual. Sampling leaves 0.5-second gaps and does not identify invisible touches.

## Automated regression

`node node_modules/jest/bin/jest.js src/components/root-navigation-stack.ui.test.tsx --runInBand`

Real Expo Router integration tests exercise the production root stack with simple destination fixtures. Before the fix, signed-out deep linking mounts settings and signing out leaves settings mounted behind auth (two failing assertions). With the fix, private tab history is removed, intro back reaches login with no older destination, and signed-in settings/back navigation remains usable.

The native root auth screen also disables interactive dismissal; the inner auth stack retains its own back gestures. These JS tests do not simulate UIKit interactive transitions or the actual intro pager.

## Native after evidence (5 October 2026, 02:27:42)

The user supplied `Screen Recording Dayova Jakob Review iPhone 05.10.2026 at 02.27.42.mp4` after testing the combined simulator containing commit `ffe687fa`.

https://github.com/user-attachments/assets/a0e8fefb-2403-4e7c-af5a-19e5411ec96c

At 00:02.5–00:05 the introduction advances through the four pages; 00:05.5–00:09 shows reverse pager transitions. At 00:11.5 and 00:13.5 the native back transition reveals the login choice, which is visible at 00:14. No settings screen appears in the inspected samples. The user confirms the interaction worked.

Coverage: 14.41-second video; 29 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.

Both complete-timeline contact sheets and the individual 00:11.5 frame inspected. No audio/transcription. Sampling gaps of 0.5 seconds remain; this records the shown run, not every device or possible gesture. Earlier Device Hub automation timed out; this evidence is the user's simulator recording.

## Repeatable native check

On a signed-in test session, visit Settings, sign out, open Registration, advance through all four intro pages, then repeatedly swipe right from the edge and from the middle, including cancelled drags. Settings must never appear during a transition. First-page edge-back should still reach the login choice. Repeat at the login choice and then confirm normal back navigation after signing in. Record the entire sequence as after evidence.
