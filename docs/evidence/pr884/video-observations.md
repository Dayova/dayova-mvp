# Recording inspection: PR #884

All four original Android recordings were inspected across their complete
timelines using `inspect-video-evidence`. Every full-timeline contact sheet was
read, alongside the generated manifest, frame index and coverage statement.
The recordings have no audio; transcription is not applicable. Attachment
URLs and file hashes are in `attachments.json`.

Observations below describe sampled frames. They do not exclude shorter events
between samples. Assertions about cache request counts, authentication and
database persistence require the separate automated/backend checks.

## 01-search-edit-back.mp4

> Coverage: 70.83-second video; 71 full-timeline frames sampled at 1 fps (1-second interval); 5 contact sheet(s); no audio stream.

- 00:06–00:10: Android keyboard, typed search, loading and the controlled
  Gedichtanalyse result.
- 00:24–00:27: explicit selection appends Gedichtanalyse after the existing
  Metaphern scope; the row indicates inclusion.
- 00:37–00:43: replacing the editor with `Metaphern ohne Hilfsmittel` removes
  the included state; the suggestion can be added again.
- 00:51–00:58: re-added term follows the edited condition, preserving both.
- 00:59–01:06: real material-upload component, with fixture-local navigation.
- 01:07–01:10: return shows both edited lines. The search query resets on the
  remount, while the authoritative scope is preserved. No database write is
  exercised by this recording.

## 02-loading-error-retry.mp4

> Coverage: 46.44-second video; 46 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.

- 00:06–00:10: two-character query `Ge` shows minimum-length guidance.
- 00:11–00:16: `Gedicht` remains in loading state with the Android keyboard.
- 00:28–00:32: injected provider error shows retry guidance; the prefilled
  Metaphern scope survives, and Continue is available after keyboard dismissal.
- 00:39: retry loading state.
- 00:41–00:45: result returns after retry without replacing the editor.
- Open rendering finding: after the fixture switch around 00:20–00:24, some
  heading/help text vanishes visually while the controls remain. This is not
  counted as successful visual acceptance.

## 03-live-provider-accounting-long-list.mp4

> Coverage: 60.12-second video; 60 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.

- 00:06–00:13: actual WLO request for `Gedichtsanalyse` / Deutsch; loading is
  visible before the Gedichtanalyse result appears.
- 00:16–00:23: Rechnungswesen scene retains the accounting scope.
- 00:27–00:33: actual `Bilanz` / Rechnungswesen search yields no suggestions;
  the accounting text and enabled Continue remain.
- 00:36–00:46: complete tax scope, then scroll to Continue.
- 00:47–00:52: material-upload component; fixture-local transition only.
- 00:53–00:59: return retains the full tax text, including the final Rohgewinn
  line, and Continue remains reachable.
- Open rendering finding: static text disappears during parts of the
  Rechnungswesen/tax scene transitions, e.g. 00:22–00:40, and returns in later
  frames. Full-route/release-build behavior is unverified.

## 04-limits-stale-subject-cache.mp4

> Coverage: 142.08-second video; 80 full-timeline frames sampled at 0.563066 fps (1.775992-second interval); 5 contact sheet(s); no audio stream.

- 00:07–00:15: controlled no-results state preserves Gedichtanalyse and Continue.
- 00:28–00:44: long query remains horizontally scrollable; after exceeding
  100 characters the shorter-query guidance replaces searching. The editor
  stays separate. The source/unit tests establish that no oversized request is
  sent; the video alone cannot show network request counts.
- 01:00–01:07: five rows and refinement guidance for seven controlled results.
- 01:09–01:14: scrolling reaches the editor and Continue.
- 01:27–01:44: delayed `Alt` request followed by `Neu`; the current result is
  visible in the sampled frames after the old response resolves. The unit test
  separately asserts rejection of stale completion.
- 01:46–01:49: a development refresh banner is visible; this interval is not
  evidence of a production navigation transition.
- 02:04–02:11: same query under Mathematik shows the controlled Vektoren result.
- 02:13–02:20: switching back to Deutsch restores Gedichtanalyse; editor text
  remains intact. Cache request counts are asserted separately in the UI test.
- Open rendering finding: several scene switches/refreshes lose static text
  temporarily; retained in the raw recording. No release readiness claimed.
