# Authenticated Android validation — 16 October 2026

These captures use the actual creation routes at frontend commit
`c9a4c4e41aafe71cc8f97004ad16ba01ba504226`, loaded by Metro from this PR checkout.
There is no fixture entry point or mocked search response. Environment: Android
16 / API 36, `Dayova_PR836` AVD in an isolated read-only emulator instance,
1080×2400, density 420, font scale 1.0, light appearance, installed development
client. The floating gear and error toast are Expo development tools.

A synthetic Clerk development account was created and verified, its Dayova trial
was activated, and the authenticated dashboard was reached before recording.
Both the Clerk development key and Convex development configuration were checked;
the app URL also matched the CLI's development deployment. Credentials and
registration screens are excluded from the published media.

The shared dev backend changed during the check: an initial CLI read reported
`wloTopics:search` absent, while a later read reached its authentication guard and
the app returned a WLO result. This run did not push backend code. Its deployed
revision is not pinned, so these captures establish observed integration behavior,
not backend revision equivalence with the frontend commit.

## Observed behavior

- In Deutsch, the live search for `Gedicht` returned `Gedichtanalyse`; selecting
  it produced a removable chip. The recording begins with the returned result;
  typing the first query occurred before recording.
- A subsequent real search for `Aufbau` failed. The screen retained the selected
  WLO topic, showed the shared search error and retry action, and allowed adding
  `Aufbau` as a custom topic. This proves a live search failure was recoverable;
  it does not identify whether the provider or adapter caused that failure.
- Continue saved both items and reached the material step. Back retained both
  individually removable chips. Removing `Aufbau`, continuing again, and returning
  retained the one remaining WLO chip. No material upload or AI generation ran.
- The development error toast temporarily covered the lower action. It was
  dismissed before continuing. This is visible in the search clip; the separate
  navigation clip begins after dismissal and the first successful save.

## Media and timestamps

[WLO selection and custom-entry recovery](https://github.com/user-attachments/assets/5260a5c4-bd0b-427a-9cbd-aa9efc408aec):
0s result; 1s selected chip; 17–22s typing `Aufbau` and loading; 23s search error;
46s both selected items. [Result screenshot](https://github.com/user-attachments/assets/0c554e13-5c60-4131-a941-1f0db676d7e4) and
[search-error screenshot](https://github.com/user-attachments/assets/3d9b9258-a5bb-429e-9eeb-f00cf36d2180) are unretouched native captures.

[Save, return, remove, and save again](https://github.com/user-attachments/assets/ac3aebf3-a71d-4537-8576-41b48ef21bf7):
0s material step; 0.5–7.5s both chips after Back; 8s custom chip removed;
13–15.5s saving; 16s material step; 19s one WLO chip after returning again.
[Returned selection screenshot](https://github.com/user-attachments/assets/ca93bed7-a909-48a4-86d4-f1bb494ac45c).

Each clip is a continuous real-time excerpt, starting at source time zero, with
only its static tail removed. They are separate recordings, not a stitched flow.
No speed changes, overlays, pixel retouching, or audio were added.

## Inspection coverage

Coverage: 90.69-second video; 91 full-timeline frames sampled at 1 fps (1-second interval); 6 contact sheet(s); no audio stream.

Coverage: 63.14-second video; 63 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

Coverage: 50.48-second video; 50 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

Coverage: 22.34-second video; 45 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); no audio stream.

All ten source contact sheets and seven exported contact sheets were inspected,
with individual frames around error, custom selection, material navigation, and
return. Export contact sheets were inspected locally. No transcription
applies. Sampling establishes the sequence, not frame-by-frame smoothness or
sub-second timing. The navigation recording uses variable frame timing; its
requested recorder time limit was 45 seconds, while its final media duration was
63.14 seconds. Durations above come from the media probe.

## Remaining limits

This adds authenticated Android head evidence. It does not replace an actual-route
capture on PR merge-base `b3273956`, iOS authenticated testing, physical-device or
VoiceOver/TalkBack checks, cold-restart draft recovery, or native multiline legacy
draft coverage. The exact legacy-text preservation regression is covered by the
rendered route/snapshot tests, which failed before the fix and passed afterward.
The older fixture comparison remains documented in [ANDROID.md](../ANDROID.md).

Media are hosted in the [PR evidence comment](https://github.com/Dayova/dayova-mvp/pull/872#issuecomment-6222750851); screenshots, recordings, and contact sheets are excluded from the source tree.

The follow-up [actual base/head and TalkBack check](../FOLLOWUP.md) supersedes the outstanding base and Android-control checks listed above. iOS and VoiceOver remain pending.
