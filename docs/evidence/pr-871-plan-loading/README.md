# Material upload → unified plan loading

Captured 15 October 2026 on iPhone 17 Pro / iOS 26.5, dark appearance,
default text size, commit `4094657e`. Real creation flow using the existing
`Mathematik - Lineare Funktionen - Demo.txt` sample, with an exam on 23 October.
The sample plan was left unaccepted.

- `01-material-upload.png`: uploaded material, before pressing Weiter.
- `02-preparing-plan.png`: live analysis with the first checklist row active.
- `03-preparing-checklist.png`: frame at source 24.4 seconds, showing the first
  two checklist rows completed and the third active.
- `material-to-loading-animation.mp4`: continuous source interval 7.0–25.5
  seconds, encoded at 720px wide / 30fps for convenient playback. No time
  acceleration, stitched stages, or simulated backend progress.

## Observations and limits

Clip 0.0–2.0s: material-upload screen. Around 2.2s the native transition begins;
by 2.4s the unified loader is visible. The flower repeatedly folds and expands.
At 17.2s the first checklist row is complete; at 17.4s the first two are complete;
by 17.8s all three are complete and the bar finishes filling.

The original recording continues beyond the shared clip: a development reload
appears at source 25.8s, followed by a connection error for a preview server on
port 8093 at 28s. This capture therefore verifies entry and preparation animation,
not successful navigation to the final review screen. Android, light appearance,
and enlarged text were not exercised. No audio stream; transcription is not
applicable. Sampled frames establish these state changes, not frame-by-frame
smoothness or timing below the 0.2-second focused sampling interval.

Inspection used `.agents/skills/inspect-video-evidence/SKILL.md`. All full-timeline
and focused contact sheets were inspected. Original recording SHA-256:
`26aede9f2c8bf41e0954a5a8ee0a305e86e09d59c098d3341076aab4a7ffd53f`.

Coverage: 30.92-second video; 31 full-timeline frames sampled at 1 fps (1-second interval); 2 contact sheet(s); 5 additional frames from 00:00:09.000 to 00:00:10.500 at 5 fps; 25 additional frames from 00:00:23.000 to 00:00:28.000 at 5 fps; no audio stream.
