# Recording observations

All complete timelines were sampled using the repository's
`inspect-video-evidence` script. Every contact sheet was inspected. These are
observations from native component QA; see README for composition and device
limits. All videos are 720×1616 H.264 and have no audio stream. Screenshots are
separate native screen captures.

| Recording | Duration | Whole-timeline coverage | Timestamped observations |
| --- | ---: | --- | --- |
| subject-keyboard.mp4 | 24.21 s | 48 frames, 2 fps, 3 sheets | 4–5 s: sheet and IME open; 5–14 s: field and both actions visible, typed value appears; 15–18.5 s: IME dismissed; 19.5–24 s: refocused field and actions remain above IME |
| custom-exam-keyboard.mp4 | 27.57 s | 55 frames, 2 fps, 4 sheets | 4–5 s: opening; 8.5–14 s: Kurztest field and actions above IME; 15–18 s: IME hidden; 19–27 s: visible refocused input/actions |
| rename-subject-keyboard.mp4 | 29.87 s | 60 frames, 2 fps, 4 sheets | 4.5–6 s: opening; 10.5–18 s: changed synthetic subject value and actions visible; 19–20 s: keyboard hidden; 21–29 s: refocused field/actions above IME |
| onboarding-name-keyboard.mp4 | 12.96 s | 26 frames, 2 fps, 2 sheets | 3–6 s: typing Alex, input and Weiter above IME; 8–10.5 s: IME hidden; 11–12.5 s: input and Weiter visible after refocusing |
| verification-keyboard.mp4 | 20.34 s | 41 frames, 2 fps, 3 sheets | 5–10.5 s: numeric IME and 123 in OTP slots; 12–14 s: IME hidden; 15–20 s: numeric keyboard reopened, code visible |
| written-answer-keyboard.mp4 | 21.75 s | 43 frames, 2 fps, 3 sheets | 4–11 s: answer area shrinks with IME, Lichtenergie and Antwort prüfen remain visible; 12–14.5 s: area grows after dismissal; 15–21 s: answer/action remain above IME after refocusing |
| rename-subject-large-text-keyboard.mp4 | 30.40 s | 30 frames, 1 fps, 2 sheets | 7–20 s: 1.5× text, field and stacked actions above IME; 21–23 s: IME hidden; 24–29 s: refocused field and stacked actions visible |
| rename-subject-largest-text-keyboard.mp4 | 23.86 s | 48 frames, 2 fps, 3 sheets | 4.5–13 s: 2× text, focused input above IME; 14–17.5 s: IME hidden; 19–23.5 s: refocused input above IME. At this size the sheet uses scrolling; this isolated composition is not a navigation-layer test. |

Coverage includes the beginning, transitions and final sampled state of every
recording. Intervals between samples limit temporal claims: no claim is made
about artifacts shorter than 0.5 s (1 s for the 1.5× clip). Native bounds checks
were performed with a visible IME, separately from video sampling.
