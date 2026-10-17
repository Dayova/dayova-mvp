# PR #884 / DAY-530: incremental UI evidence

Archive only. Do not merge this branch into application source. Uploaded using `gh api` as requested.

Before: a58b0d7953d11f7394750be47ede3b93908df3b9. After: 30c8046000053e6cd09712f3a3d2d9c7028a25da. This compares the previous PR head to the requested follow-up, not main to the entire PR.

Captured 17–18 October 2026, iPhone 17 Pro simulator / iOS 26.5 / dark appearance. Actual RequiredTopicsStep, TopicSearch and ExamHintsEditor components, shared Dayova controls/fonts/providers. Synthetic Deutsch/Gedichtanalyse state and controlled Rhetor search results. Footer controls are capture tooling. No live WLO request, authenticated full route, database save/reopen, Android, physical iPhone, screen reader, large text or light theme acceptance is established.

Four PNGs show before/after topics and hints. Two original H.264 MP4 recordings have no audio. No retouching or synthesized frames. Before video has transient simulator rendering/scaling artifacts around 32–44s; after video includes the iOS clipboard permission dialog around 26–28s. The custom hint recorded is exactly “Nur Kapitel”.

## Video observations

- Before 13–20s: Rhetor search and original checkbox cards. 21–31s: explicit selection creates two topic chips. 46s: cleared search retains selections. 50s: first hint appended.
- After 6–9s: Text filters the hint suggestions. 10s: adding Textbelege mit Zeilenangaben clears the query. 18s: a second hint is appended. 19–25s: Nur Kapitel query preserves both existing lines. 45–52s: custom addition leaves three lines and clears the query.

Coverage: 50.77-second video; 51 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

Coverage: 52.88-second video; 53 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

All eight full-timeline contact sheets and relevant individual frames were inspected. One-second sampling cannot exclude brief intervening events. Static after-topics.png establishes the revised topic layout; the after recording focuses on hints.

This archive uses repository file links instead of GitHub comment attachments because upload was explicitly requested through the CLI. It is not an application release. PR remains draft pending broader acceptance.
