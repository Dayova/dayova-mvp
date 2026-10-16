# DAY-513 native layout evidence — 2026-10-16

Issue: [DAY-513](https://linear.app/dayova/issue/DAY-513).

## Source and method

Before is `main` at `3eb4e5d29f8cb2771fb79825c3b447587c514740`;
after is implementation commit `10dc6579` on `codex/wissenscheck-header-reflow`.
The PR's later documentation commit does not change the captured UI.

Both sides render the original full learning-session screen from those snapshots
inside the same Expo 57 / React Native 0.86.3 native development client. The
fixture freezes one written DEA question from the report and a ten-minute Praxis
session. Authentication, Convex operations, analytics, haptics, and the navigation
destination are stubbed. Fonts, theme providers, safe areas, keyboard controller,
header, timer, question, input, footer and native layout are real app components.
Unused destination/choice components are omitted from the fixture bundle.

The screenshots are native device captures. Comparison PNGs only add labels and
place equally scaled captures side by side; there is no retouching of app pixels.
The before and after sides use the same question, device, system size and theme.
Timer captures use the same settling procedure; the countdown continues during
native gestures and captures.

## Native matrix

| Device | Settings | Evidence / result |
| --- | --- | --- |
| iPhone 17 Pro, iOS 26.5, 1206×2622 | Default Dynamic Type (`large`) | Before/after; full title fits |
| Same | `extra-large` Dynamic Type | Before truncates to `Wissensch…`; after shows `Wissenscheck` |
| Same | Maximum accessibility Dynamic Type (`accessibility-extra-extra-extra-large`) | Before splits title/words and creates very tall half-width actions; after full title in its own row and stacked actions with natural word wrapping |
| Same | Maximum size, timed Praxis | Before/after; after timer in controls row, title below |
| Same | Maximum size, dark appearance | After screenshot; title and controls visible |
| Pixel 9 AVD, Android API 36, 1080×2424 | Density 420 (≈411 dp), font scale 1.0 / 1.15 / 2.0 | Before/after at each setting |
| Same | Density 540 (320 dp), font scale 1.0 / 2.0 | Compact and combined display/text sizing before/after |
| Same | Density 540, font scale 2.0, timed Praxis | Before/after; full title below controls |
| Same | Combined maximum settings, dark appearance | After screenshot |

Android runs in a temporary writable overlay over the existing Pixel AVD's
read-only userdata. The installed client in that disposable overlay is EAS build
`115ecf95-94a3-4628-9504-96d03c8abc12`; the iOS client is build
`9efabeef-8d3b-41cd-8c81-b186bb57ed34`. No original emulator account or app data is
replaced. Both clients load the same captured JavaScript snapshots.

Android checks also exercise font scale 2.0 together with the 320 dp viewport.
The after title remains complete at that combination.

The native back action is pressed by Maestro after two actual scroll gestures at
maximum text size. Maestro confirms the title is visible and the back callback
reaches the fixture's “Zurück zum Lernplan” destination. This establishes native
gesture/callback behavior, not real server persistence or full navigation wiring.

## Automated verification

- `pnpm check`: pass (Biome lint, ESLint, TypeScript).
- Header regression tests plus existing session completion flow: 7 passed.
- Shared content-size layout unit tests: 6 passed.
- The four new header tests fail against the original header and pass with the fix.
- Independent Standards review: 0 findings. Independent Spec review: 0 findings.
- Full `pnpm format:check` encounters pre-existing formatting errors in
  `scripts/publish-production-ota.mjs` and
  `src/features/learning-plans/use-prepare-session-content.ui.test.tsx`.
  Those files are unchanged by this PR; changed TypeScript files pass Biome.

## Video observations and coverage

`ios-comparison.mp4`:

- 00:00–00:02.5: baseline moderate text, truncated header.
- 00:03–00:04: after screen mounts with the existing input autofocus/keyboard.
- 00:04.5–00:08: full title after keyboard dismissal.
- 00:08.5–00:12: maximum Dynamic Type; full-width title and stacked actions.
- 00:12.5–end: timed Praxis, timer counts down in the controls row.

Coverage: 19.09-second video; 40 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); no audio stream.

All three complete-timeline contact sheets were visually inspected.

`android-interaction.mp4`: 00:00–00:02.5 shows the complete title and stacked
controls at 200% text / 320 dp; 00:03–00:04.5 scrolls the written question until
the answer input is visible; the remaining timeline holds the scrolled state.
Back-callback verification is covered separately by the iOS Maestro run.

Coverage: 11.24-second video; 22 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.

Both complete-timeline contact sheets were visually inspected. Sampling
supports the settled layouts and visible countdown; it is not a frame-by-frame
animation or performance measurement. No speech transcription was applicable.

`android-comparison.mp4`:

- 00:00–00:02: baseline at 115% text; truncated title.
- 00:03–00:04: after screen mounts with the existing input autofocus/keyboard.
- 00:05–00:10: corrected moderate-size layout.
- 00:11–00:18: baseline at 200% text / 320 dp; title split across four lines.
- 00:19–00:20: after transition and keyboard dismissal at combined maximum sizing.
- 00:21–00:24: complete full-width title and stacked actions at combined maximum sizing.
- 00:25–end: timed Praxis, complete title below the controls and visible countdown.

Coverage: 32.61-second video; 33 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.

All three complete-timeline contact sheets were visually inspected. Each recording
is silent; no audio transcription was applicable. Sampling establishes the visible
settled states and scrolling, not smooth animation or complete accessibility behavior.

## Remaining bounds

These are native fixture checks, not an end-to-end production-account test.
Physical devices, tablets, landscape, iOS Display Zoom, VoiceOver/TalkBack speech,
answer evaluation and the full completion flow were not exercised natively.
Multiple-choice content has a pre-existing separate scrolling restriction; this
written-question fixture does not certify every question type at extreme sizes.
The shared heading multiplier remains the existing 1.75 policy; body and button
text retain unrestricted system scaling.
