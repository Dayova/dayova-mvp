# Selection brand and motion · 5 October 2026

## Input evidence

Reviewed the five supplied screenshots and all three full-timeline contact
sheets from the local screen recording, plus a focused 20 fps sheet.
Private source media remains local.

Coverage: 16.98-second video; 34 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); 12 additional frames from 00:00:01.000 to 00:00:01.600 at 20 fps; audio stream detected; transcription not performed.

Observed: answer B remains selected at 1.35 s; A is selected with a slightly
compressed card at 1.40 s, settling by 1.45–1.55 s. Exam-type choices change
between 9–12 s; a subject is selected by 14 s. The selected badge/check fills
are visibly darker than the bottom action-button gradient.

Interpretation: shared press feedback and selection transitions fit the requested
microinteraction. Sampling does not establish the exact spring curve or frame
performance. Audio was not transcribed: the task concerns visual interaction.

## Validation

- Complete Jest UI suite: 88 suites, 418 tests passed.
- Selection contrast and canonical-gradient tests: 2 passed.
- TypeScript (`tsc --noEmit`), scoped Biome/ESLint and `git diff --check`: passed.
- Manual diff review: checked immediate controlled state, rapid switching,
  canceled/disabled presses, reduced-motion paths, theme-independent gradient,
  hit-area stability and removal of the duplicate answer animation.
- Automated assertions verify behavior and accessibility, not native physics.

Native preview was attempted in a separate iOS
26.4 simulator; its SpringBoard remained at the startup spinner. Android tools
are unavailable on this host. No new native screenshot or release-performance
claim is made. Still required: light/dark and large-text visual verification,
rapid selection and reduced-motion inspection on a working native runtime.
