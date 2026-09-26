# Native routine confirmation handoff

Combined QA client, based on #760 (`be6d76e2`) plus this scoped handoff fix.
Metro 8092; dev backend `trustworthy-skunk-257`. No production deployment.

## Defect and fix

The initial iPhone run did not reach `Nur heute übernehmen` after confirming
the picker. The original attribution to the modal transition is **not a
deterministically reproduced native defect**: the clean parent retest below
also reaches consent. Earlier runs were affected by a development warning
overlay and must not be presented as conclusive before-failure evidence. The follow-up
dialog now opens after the picker dismissal callback, not during dismissal.
Android reports dismissal after the native picker unmounts.

## Parent comparison and review qualification

The unmodified parent `be6d76e2a1679303d55ff06ac0280d1109bb405d`
was loaded through Metro 8094 on the same iPhone. In
[the complete parent recording](ios-parent-retest.mp4), the warning overlay
is dismissed at 00:14.5, the picker is visible at 00:21–22, and consent
appears at 00:23–24.5. The view returns home at 00:25 after the test ends;
this recording alone does not establish the reason for that dismissal.
A second parent run also passed an assertion after `waitForAnimationToEnd`.

Coverage: 28.05-second video; 56 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); no audio stream.

All four contact sheets were inspected. Source SHA-256:
`675e96857413d832080030e8cc1df2f68721b66416899566f407d0d248633cf6`.
The 0.5-second sampling cannot resolve every transition frame.
This is a transparent baseline comparison, **not** a proven failing-before/
passing-after pair. Review #761 as explicit dismissal sequencing with passing
current-build native tests, not as a deterministically reproduced fix.

Current-build recording and real OS reminder delivery are documented in
[the delivery report](delivery.md). The independently reproduced iOS delivery
timestamp defect is fixed separately in [#762](https://github.com/Dayova/dayova-mvp/pull/762).

## Observations (26 September 2026, Europe/Berlin)

- iPhone 12:05: preview 17:00 → 16:30; cancel preserved 17:00; reopen and explicit
  consent saved 16:30. Backend and calendar confirmed 20 minutes, not started.
  The original script's final assertion expected the coach to reappear and
  failed: the product intentionally dismisses it for today after success.
  The corrected complete script was subsequently rerun successfully at 12:18:
  `2026-09-26_121853`, on code commit `6b6a61fe`. Earlier run: `2026-09-26_120502`.
- Android 12:09: 16:30 → 17:00 consent completed, and the coach disappeared.
  Complete Maestro run passed: `2026-09-26_120845`.
- Android AlarmManager before/after: today's Dayova alarms changed from
  **16:15 and 17:05** to **16:45 and 17:35**; the old times were absent after
  the change. This proves OS scheduling reconciliation, not later delivery.
- iPhone push permission was not yet granted while the first move succeeded.
  Permission was subsequently granted through the native dialog for this QA
  test. The 12:18 replay replaced the native pending requests for the same entry:
  before-event **16:45 → 16:15**, forgotten-event **17:35 → 17:05**.
  Both request identifiers changed; the previous requests were absent.
  Read-only evidence came from this app's native `PendingNotifications.plist`,
  resolving the archived request date plus trigger interval in Europe/Berlin.
  Actual later delivery is not claimed; this test verifies scheduling.

Fixture `qa-native-only-today-20260926` creates one new plan/session/calendar
entry only. A separate date-limited internal replay resets only the known QA
account's daily prompt dismissal for the second platform. Existing sessions,
answers and recurring times are not reset. Do not count synthetic data as
organic learning history.

## Automated checks

6 rendered UI tests; 16 routine/notification tests; 9 fixture tests passed.
TypeScript and targeted ESLint passed. No source-text assertions substitute
for the native observations above.

## Screenshots

<a href="ios-preview.png"><img src="ios-preview.png" width="180" alt="iPhone explicit consent"/></a>
<a href="ios-after.png"><img src="ios-after.png" width="180" alt="iPhone calendar after move"/></a>
<a href="android-preview.png"><img src="android-preview.png" width="180" alt="Android explicit consent"/></a>
<a href="android-after.png"><img src="android-after.png" width="180" alt="Android after consent"/></a>

The thumbnails are still images; recordings have separate coverage reports.
No full product-quality acceptance is claimed.
