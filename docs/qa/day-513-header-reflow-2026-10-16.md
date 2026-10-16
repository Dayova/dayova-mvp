# DAY-513 native layout evidence — 2026-10-16

Issue: [DAY-513](https://linear.app/dayova/issue/DAY-513).

## Decision and source

Job: answer the current question. Hierarchy: question, answer/input and actions,
then navigation/progress. Primary action: **Beantworten**, retaining the approved
copy and normal-size pill layout. At extreme sizes, oversized fixed actions must
stop displacing the question; unavoidable action-word breaks must be intentional.

Before is `main` at `3eb4e5d29f8cb2771fb79825c3b447587c514740`.
Current UI commit is `970db356` on `codex/wissenscheck-header-reflow`.
Android captures use that commit. iOS captures and videos use `6b1af104`;
the only later UI delta is keyboard placement (automatic header offset on iOS,
and moving Android actions into the scroll when the keyboard is visible).
The captured closed-keyboard iOS layout is unchanged.
Later evidence/documentation commits do not change the captured UI. File hashes
are in `day-513-native-provenance.json`.

Both sides use the original complete learning-session screen in Expo 57 / React
Native 0.86.3 native development clients. Authentication, Convex operations,
analytics, haptics and navigation destinations are stubbed. The synthetic DEA
question is frozen. Fonts, theme providers, keyboard controller, safe areas,
header, timer, question, input, choices, selection controls and buttons are real.
Scenario controls reset the fixture and dismiss the native keyboard after mount
for matched closed-keyboard comparisons. Keyboard-open checks opt out of that
dismissal. No production-account persistence or server evaluation is established.

All screenshots are native captures. Comparison PNGs only add source labels and
place equally scaled captures side by side. App pixels are not retouched.

## Layout behavior

- Shared headers measure their controls and give wrapping titles a complete row.
- Standard action labels remain **Beantworten**. Centered labels use optional
  German soft-hyphen breaks only when necessary; accessible names retain the
  original words. Body and controls keep full system text scaling.
- Actions stay pinned when their measured height uses at most 40% of the usable
  question area. Larger actions join the content scroll. iOS keyboard height is
  deducted from that budget. Android edge-to-edge windows can remain full height
  behind the keyboard: while it is visible, actions join the scroll. Pinned iOS
  actions use the keyboard controller’s automatic offset for the nested header.
- Multiple-choice content can scroll. At compact/enlarged sizes, choice letters
  and selection indicators sit above the full-width answer text.
- Normal-size written/feedback overscroll behavior is preserved.

## Verification

`pnpm check` passed (Biome, ESLint, TypeScript). Full `pnpm test` passed:
138 Vitest files / 1,068 tests, 18 script tests, 99 Jest suites / 508 tests (1,594 tests total).
The measured-layout regression covers footer growth,
keyboard appearance/dismissal, and returning to a larger viewport.
The Android keyboard regression was run red against `6b1af104`, then green
with the fix. The original four header tests remain red against the original header.

Standards review: **0 findings**. Spec review: **0 findings**. Independent agents
reviewed the entire follow-up, including the new layout component and test.
CodeRabbit CLI completed a review of the committed follow-up and raised two
suggestions. The missing keyboard/header offset was valid and fixed in
`970db356`. The proposed content-wrapper flex change was not adopted: native
maximum-size written and multiple-choice recordings traverse the whole question,
all choices and the footer without clipping, and the independent Standards
review found no reproducible issue. Remote CodeRabbit skips draft PRs.

Full `pnpm format:check` has two known, unchanged baseline failures:
`scripts/publish-production-ota.mjs` and
`src/features/learning-plans/use-prepare-session-content.ui.test.tsx`.
Changed TypeScript files pass Biome.

## Native matrix

| Device | Settings | Result |
| --- | --- | --- |
| iPhone 17 Pro, iOS 26.5, 1206×2622 | Default (`large`) and moderate (`extra-large`) Dynamic Type | Matched before/after; full title, original single-line buttons; moderate body/action geometry matches baseline |
| Same | Maximum accessibility Dynamic Type (`accessibility-extra-extra-extra-large`) | Full title; readable question viewport; input and centered Beant-/worten actions reached by native scroll |
| Same | Maximum, timed Praxis and dark appearance | Full title and timer, native screenshots |
| Same | Maximum, multiple choice | All four choices traversed, D selected, Beantworten reached, native back reaches fixture destination |

| iPhone 13 mini, iOS 26.5, approximately 375×812 logical points | Default and maximum Dynamic Type; maximum timed Praxis | Complete header; normal actions unchanged; maximum actions reached by native scroll |
| Same | Maximum, pending evaluation | Both complete actions reachable; spinner and centered Analysiere label wrap without clipping |
| Pixel 9 AVD, Android API 36, 1080×2424 | Density 420 (about 411 dp), font scale 1.0 / 2.0 | Matched native before/after; full title; normal single-line Beantworten |
| Same | Density 540 (320 dp), font scale 1.0 | Native screenshot: full title, original labels, vertically arranged actions |
| Same | 320 dp + font scale 2.0 + actual software keyboard | Native hierarchy places session-actions inside session-scroll; actions reached by native swipes; tapping Weiß ich nicht shows the pending evaluation state |

Android's final moderate-size comparison, combined maximum display/text, timer,
and dark-mode captures were blank or covered by a System UI ANR. The final
multiple-choice selection/back recording stalled before selection could be
established. These captures and the incomplete recording are excluded. A retry
with conservative software graphics was blocked by insufficient host disk space.
The successful default, maximum-font, compact-display and keyboard/action captures
remain usable; no full current combined-size matrix or Android animation claim
is made.
Android keyboard/action/pending-state evidence is provided as native screenshots;
the complete choice-selection and back interaction is established by the iOS video.
The mini's focused-input check did not show a software keyboard, so it is not
counted as keyboard-open verification.

The iOS client is EAS build `9efabeef-8d3b-41cd-8c81-b186bb57ed34`.
The Android client is build `115ecf95-94a3-4628-9504-96d03c8abc12`.
Android uses a temporary writable overlay over the original Pixel AVD's read-only
userdata. Original accounts and app data are preserved.

## Video observations and coverage

`ios-maximum-written-scroll.mp4`:

- 00:00–00:00.5: fixture keyboard dismissal and scroll reset settle.
- 00:00.5–00:02.5: complete header and question at maximum text size.
- 00:03–00:06.5: native scroll traverses the question and answer field.
- 00:07–00:09: both complete, centered actions are reachable.
- 00:09.5: native back reaches “Zurück zum Lernplan” (fixture destination).

Coverage: 9.92-second video; 20 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.

`ios-maximum-choice-scroll.mp4`:

- 00:00–00:07: full header remains visible while question is scrolled.
- 00:07.5–00:19: choices A through D pass through the full-width reading area.
- 00:19.5: D becomes visibly selected.
- 00:21.5–00:23: complete Beantworten action is visible below the choices.
- 00:23.5: native back reaches the fixture destination.

Coverage: 23.85-second video; 50 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); no audio stream.

Every complete-timeline contact sheet for these videos was visually inspected.
No audio transcription was applicable. Sampling verifies settled states and
reachability, not frame-perfect animation smoothness.

## Remaining bounds

Dayova uses Poppins Regular/SemiBold, rather than arbitrary system font families.
These checks exercise system text/display sizes with those actual app fonts.
Semantic headings retain the existing shared 1.75 scaling curve; body, controls
and supporting text remain uncapped. At the largest setting, long question words
can still require native line wrapping.

These are native fixture checks, not a production-account end-to-end test.
Physical devices, tablets, landscape, spoken VoiceOver/TalkBack, server answer
evaluation and the full completion flow are outside this evidence. iOS Display
Zoom could not be selected in the available simulator Settings surface; it
remains a physical-device verification boundary.
