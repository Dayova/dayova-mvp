# Current preparation flow: upload through review

Captured 15 October 2026 on iPhone 17 Pro / iOS 26.5, dark appearance,
default text size, implementation commit `b73c36d6`. This supersedes the older
animation for current behavior. The existing mathematics demo was uploaded to
the saved 29 October exam draft. The plan was left at review, unaccepted.

`material-to-review-current.mp4` is a continuous, real-time 23-second excerpt
(source 6.5–29.5 seconds), encoded at 720×1566 / 30fps. No accelerated time,
stitched stages, fake backend results, or development reloads. The developer
tools button remains visible. `04-review-current.png` is the frame at 21 seconds.

## Observations

- 0–2.5s: material-upload screen before continuing.
- 3–7s: Unterlagen analysieren is active.
- 7.5–12.5s: Prüfungsstoff zusammenstellen is active.
- 13–18.5s: Wissenscheck und Lernweg vorbereiten is active.
- 19s: automatic transition to review is visible.
- 19.5–23s: Was kannst du schon? offers Jetzt starten and Termin wählen.

These are visual observations. The checklist uses estimated phases; the video
alone does not establish individual backend request durations. The last item
stays active until the automatic handoff. Code and tests separately verify
that completion adds no animation hold. This recording does not demonstrate
learning the estimate across multiple runs, Android, light mode, or large text.

All three source and all three final-export contact sheets were inspected with
`.agents/skills/inspect-video-evidence/SKILL.md`. No audio stream; transcription
is not applicable. Sampling supports the sequence above, not frame-by-frame
smoothness or sub-0.5-second timing.

Coverage: 32.56-second video; 33 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.

Coverage: 23.00-second video; 46 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); no audio stream.
