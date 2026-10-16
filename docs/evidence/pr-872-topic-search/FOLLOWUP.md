# Actual base/head and TalkBack follow-up — 16 October 2026

The [GitHub evidence comment](https://github.com/Dayova/dayova-mvp/pull/872#issuecomment-6222750851)
hosts the screenshots and three continuous native recordings. No media binaries
are source artifacts.

## Revisions and environment

- Base frontend: `9024a002`, the `main` revision first merged into this PR.
- Head frontend during capture: `8746e85084bfc0c66c83e1e55e0e006ce2029118`.
- Actual authenticated creation routes; no fixture entry point or mocked search.
- Android 16 / API 36, isolated read-only `Dayova_PR836` AVD, 1080×2400,
  density 420, light appearance, font scale 1.0, installed development client.
- Synthetic Clerk development account and development Dayova trial. Registration
  and credentials are excluded from the published evidence.
- PostHog was disabled through an empty development API-key setting in both runs.
  With the existing key enabled, this base's analytics provider throws
  `Invalid analytics property: eas_channel` in the development client. The
  disabled-provider development toast was dismissed before base recording and
  final resume checks. Search and persistence were live.

After capture, `main` advanced to `8b9b8af5` with PR #869's creation header and
pause-saving changes. The final integration retains those changes and sends
`topicItems` on both Continue and pause. The captures above establish the named
revisions, not a native test of that subsequent header integration. The merged
route has 52 passing focused UI tests, including pause success, failure, invalid
input, stale-route protection, boundary-only pause edits, and the topic-boundary regressions. The Mac run
must fetch and record the final head revision explicitly.

The configured Convex target was confirmed as development. Functions from
`8746e850` were pushed successfully with schema validation and TypeScript. Later,
a save rejected the new `topicItems` argument, indicating that the shared dev
deployment had changed. A second push of the same tested functions restored
saving before the successful resume check. There is no claim of exclusive access
or a permanent deployment pin. No production deploy or OTA was performed.

## Observations

The base has the free-text topic field. Its recording shows the supplied text at
0s, saving at 9s, and the material step at 13s; returning to topics was checked
after recording.

The head returned `Gedichtanalyse` for the live `Gedicht` query. The recording
starts with that result and shows the added chip alongside the existing free-text
item at 23s. TalkBack's displayed speech output is visible. This clip does not
include the later search-error check.

A real `Aufbau` search failed. TalkBack's displayed speech output contained the
complete recoverable error; Retry and custom-topic entry were keyboard-focusable.
A separate direct provider check reproduced HTTP 404 and `DAOMissingException` for
that query, while `Gedicht` returned HTTP 200 and a valid six-collection response.
This was not simulated offline mode. Adding the custom topic worked with
TalkBack active.

For persistence, an ordinary free-text item plus custom `Meiose` were saved. The
creation route was left for the plan overview, then reopened through its saved
draft. Both items returned as individual chips. Removing `Meiose`, saving again,
and returning left the original item intact. The resume recording starts with
the saved two-item material hint, reaches topics at 36s, and removes `Meiose` at
56s. The final save and return occurred after the recording and have a screenshot.
This is route-remount coverage, not a full process-restart persistence check.
Exact multiline, whitespace, indentation, and repeated-line preservation are
covered by backend and rendered route regressions; this native check used the
ordinary text shown in the screenshot.

## TalkBack scope

Actual TalkBack 16.0.0.738667889 was verified as a bound spoken-feedback service.
Tab/Enter navigation reached the search field, removal actions, Continue, error,
Retry, and custom entry. The visible utterance overlay showed the removal label,
Continue, and complete search-error text. This is a real TalkBack control and
utterance-output check; no acoustic assessment, complete focus-order audit, or
complete touch-gesture pass is claimed. Physical devices remain untested.

EAS rejected iOS simulator startup because Dayova is not enabled for the service;
no remote session was created. The user has a Mac and received a self-contained
local iOS/VoiceOver testing prompt. That report and a team member's human approval
remain outstanding. Do not mark iOS or VoiceOver successful without the report.

## Video inspection

Coverage: 23.67-second video; 47 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); no audio stream.

Coverage: 58.83-second video; 59 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

Coverage: 57.67-second video; 58 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

All eleven full-timeline contact sheets and relevant individual frames were
inspected. No transcription applies. The clips are separate continuous real-time
native recordings, with no retouching, speed changes, or stitched stages. Sampling
does not establish sub-second timing or animation smoothness. Contact sheets and
source recordings were inspected locally and remain outside the repository.

## Direct artifacts

- [Actual base screenshot](https://github.com/user-attachments/assets/feeefad5-f84e-4d19-8662-0f362d32eda0)
- [Actual base recording](https://github.com/user-attachments/assets/e36f4dcd-3326-4497-84e5-89194eeea15f)
- [Head live result](https://github.com/user-attachments/assets/809f3632-e394-4ff2-9fa8-3eabe323b241)
- [Head selection recording](https://github.com/user-attachments/assets/9a1fc504-c5fa-4390-be25-22bc76670fab)
- [Restored individual chips](https://github.com/user-attachments/assets/b7288c1c-822b-419b-8d9f-e328f606edf3)
- [Resume and removal recording](https://github.com/user-attachments/assets/24973bc1-61da-4c0c-9752-7d8f91cb531d)
- [After removal, save, and return](https://github.com/user-attachments/assets/53325738-b6ce-4629-8ab9-7b4d53340194)
- [TalkBack error speech output](https://github.com/user-attachments/assets/fb3658ca-4753-43cd-b8ab-0ff6fc25956e)
