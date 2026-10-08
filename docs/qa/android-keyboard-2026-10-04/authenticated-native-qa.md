# Authenticated native keyboard QA — 2026-10-05

The regular application passes the exercised keyboard cases on Android/Gboard
and on a small iOS simulator. This supplements the initial component captures;
it does not establish compatibility with every device or keyboard.
No further production-code change was needed after this pass.

## Environment and fixtures

JavaScript was taken from PR #831 at `d20a1240` (the original fix plus the existing
branch's main merge). Android used the locally built development APK on
DAY_169_Pixel_9, Android 16/API 36, at 720×1616/280 dpi, font scale 1.0.
iOS used iPhone 13 mini, iOS 26.5, with a 375×812 logical viewport. Its existing
EAS simulator artifact `3959d7b9-92a0-4fb0-8bb9-7dff763b5be4` was installed with
this checkout's exported JS bundle and assets substituted locally. Its Expo
57.0.20, RN 0.86.3, keyboard-controller 1.21.9 and Gorhom 5.2.14 dependencies
match the checkout. This is native runtime QA, not a new signed iOS build.
Native iOS recordings are 1080×2340; Maestro screenshots are 1124×2436.

A disposable Clerk development account logged in on both platforms, including
the email-code security check. A synthetic profile, expiring non-renewing access
fixture and one ready written practice item were seeded only in the development
backend. The regular router, providers, authenticated queries and subject
mutations were exercised. Backend functions were synchronized to the current
checkout for this development run. No production backend was deployed, purchase
made, AI answer submitted or real user data edited. Profile and creation-form
edits were left unsaved. AI consent was declined.

Subject add and rename were actually saved: iOS created `LateinQA`, renamed it to
`LateinQA2`, and Android subsequently displayed that same persisted row. Android
created `RobotikQA` and saved `RobotikQA2` after keyboard dismissal/refocusing.
The account password was rotated after QA. Private credentials and login debug
captures are excluded from the PR evidence.

## Coverage

| Area | Android | iOS | Practical limit |
| --- | --- | --- | --- |
| Login email/password and verification | Real login; visible numeric keyboard and OTP bounds checked | Real login; numeric OTP screenshot | Fresh onboarding completion was not repeated |
| Add personal subject | Actual input bounds, screenshot, recording, saved row | Screenshot, recording, saved row | Caller reuse additionally audited in code |
| Rename personal subject | Bounds and actions visible; hide/refocus; saved row | Input/actions visible while clearing, typing and saving | Enlarged fonts 1.5/2.0 covered in the earlier Android component pass |
| Custom exam type | Actual exam route; input bounds and screenshot | Actual exam route; input and both actions visible | Draft not submitted |
| Written practice answer | Actual session; input and Beantworten bounds; typing, hide/refocus recording | Actual session; typed answer and Beantworten screenshot/recording | Content was seeded; no AI grading invoked |
| Profile | Email input above IME, screenshot | Name and email typed with open keyboard, screenshots | Profile updates not submitted |
| Password change | Confirmation input above IME in native bounds check | Confirmation field typed and visible above IME, screenshot | Android's later screenshot has a dismissed keyboard and is not published as keyboard proof; no full password-change form submission |
| Homework note | Typed note above IME, input bounds and screenshot | Typed note and Weiter visible above IME | No homework saved; multiline forms remain scrollable |
| Learning-plan topics | Actual topic step, input bounds, screenshot; Weiter visible | Actual topic step, typed text/caret visible above IME | Draft not submitted; iOS content can require scrolling for the action |
| Timetable room | Code audit only | Code audit only | Timetable layout deliberately redirects home (DAY-436) |
| Forced password reset, recovery, other onboarding text steps | Existing scrolling/container audit and UI suites | Container audit | Not every server-driven state was reached natively |

Android checks used `--input` to require `android.widget.EditText`, rather than
accepting a same-named static label. In the fresh repeat, IME top was 1035;
subject-add and exam-type input bottoms were 671, rename 797, topic 849.
Written-answer bottoms were 499 while scrolled and 704 after refocusing;
Beantworten ended at 993 in both states. Screenshots were visually inspected
in addition to native geometry. A passed automation command alone is not proof.

Earlier long-running Android attempts suffered host memory pressure and stalled
layout transitions. They were not published as successful complete recordings.
With iOS shut down and Android restarted, the fresh subject and written-answer
recordings below passed; no additional stable obstruction was reproduced.
This is an environment-related interpretation, not a claim that all transient
animation states or all possible devices are perfect.

## Delivered recordings

Every listed recording was inspected across its complete timeline: metadata,
frame index and coverage were read, and every generated contact sheet was viewed.
There is no audio to transcribe. Sampling cannot exclude artifacts shorter than
the stated interval. Android clips are native captures; the two iOS review clips
are time-trimmed/re-encoded excerpts with unchanged image dimensions, no spatial
edits and no speed change. PNG screenshots are unretouched.

| File | Timestamped observations | Verbatim coverage |
| --- | --- | --- |
| android-subjects-repeat.mp4 | 3–5 s: sheet/keyboard opening; 5–14 s: RobotikQA and actions visible; 15–21 s: saved row; 23–31 s: rename field/actions visible while typing; 32–36 s: keyboard dismissal; 37–38 s: reopening animation; 38–47 s: refocused field/actions above IME; 49 s: saved RobotikQA2 row | Coverage: 49.86-second video; 50 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream. |
| android-written-repeat.mp4 | 2–3 s: focus/keyboard opening; 3.5–13 s: typed answer and action above IME; 13.5–18.5 s: keyboard hidden and answer expands; 19–20 s: refocus/layout settles; 20–26 s: answer and Beantworten above IME | Coverage: 26.57-second video; 53 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); no audio stream. |
| ios-subjects-review.mp4 | Source 17–33 s. 1.5–3 s: add sheet and IME opening; 3–4 s: typed input/actions above IME; 4.5–5.5 s: saved LateinQA; 6–7.5 s: rename opening; 8–13 s: clearing/typing, field/save visible; 14–15.5 s: persisted LateinQA2 | Coverage: 16.08-second video; 32 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream. |
| ios-written-answer-review.mp4 | Source 16–19 s. 0–0.5 s: focused answer and IME opening; 1–2.5 s: Lichtenergie and Beantworten visible above IME | Coverage: 3.10-second video; 6 full-timeline frames sampled at 2 fps (0.5-second interval); 1 contact sheet(s); no audio stream. |

The full iOS source recordings were also inspected: 56.30 s/73 samples/5 sheets
for subjects and 61.85 s/78 samples/5 sheets for written answer and later forms.
Idle time and unsuccessful automation selectors after the useful flows are
excluded from the review excerpts. Keyboard-opening/closing animations are
visible; the assertions target the settled, focused input state.

## Validation and cleanup

The existing source validation remains recorded in README: 93 tests in six UI
suites, TypeScript, full lint, native Android build and regular Hermes export.
The branch's CI lint/typecheck/test job also passed at `d20a1240`.
This follow-up changes only QA documentation and the native assertion helper;
its help output, syntax and stricter live native checks were verified.

Original Android display/font settings and dev-menu preferences were restored.
The pre-existing emulator launch service is running with its original arguments;
the task's Metro process, adb reverse and caffeinate process were stopped. The
task-installed iOS app was uninstalled and its previously stopped simulator shut
down. No Keychain default/search-list settings were changed.

Samsung Keyboard, physical devices, every OS version, landscape and tablet
layouts remain unverified. The report supports the tested flows, not an
unqualified “works everywhere” claim.
