# Theme switching: native navigation and picker

## Reported recording

The private user recording stays local; it is not included in this pull request.

Coverage: 20.09-second video; 40 full-timeline frames sampled at 2 fps (0.5-second interval); 3 contact sheet(s); 12 additional frames from 00:00:01.400 to 00:00:02.200 at 20 fps; 18 additional frames from 00:00:01.800 to 00:00:02.800 at 20 fps; no audio stream.

All full-timeline and focused contact sheets were inspected. There is no audio to transcribe. Sampling can miss events between frames and does not establish frame-perfect animation timing.

Observed: at approximately 2–2.5 s and 5–8 s, dark content has a light bottom tab bar. A tab change around 12.5 s restores the dark bar; returning around 14 s keeps it dark. Another mismatch appears around 16 s and resolves after navigation around 17 s. The focused 2.05–2.10 s frames show the picker selection changing without an intermediate position in those samples.

## Cause and correction

The app supplies reactive icon, label and indicator colors to `NativeTabs`, but previously omitted its background. On Android, react-native-screens' `TabsAppearanceApplicator.updateSharedAppearance` falls back to the Material `colorSurfaceContainer` from its native context. In the reproduction that fallback retains the previous appearance until a tab change reapplies it.

Supplying `colors.surface` explicitly on Android makes the background update with the other app colors. There is no theme-dependent navigator key or remount. iOS keeps its adaptive native/glass background.

The picker now has one continuously mounted gradient indicator moving between its three positions over 240 ms, with icons fading to/from white. New selections retarget the same shared position. `ReduceMotion.System` respects the OS preference. Selecting the already selected option does not write the preference again.

## Native Android reproduction

Native Pixel 9 AVD (`DAY_169_Pixel_9`), Expo Go 57.0.9, React Native 0.86.3, react-native-screens 4.26.2, Reanimated 4.5.1 / Worklets 0.10.1. A temporary minimal Expo Router harness imports the actual app tab layout, `DayovaThemeProvider`, and picker, removing authentication/backend dependencies. This is a native component integration test, not an authenticated whole-app smoke test.

The same Maestro sequence selects light, selects dark, captures the bar, navigates to Pläne and back to Einstellungen, then captures it again. A pixel check samples a 12×12 region away from labels/icons at 5% width and 92.5% height.

| Build | Immediately after dark selection | After tab round-trip | Result |
| --- | --- | --- | --- |
| Before background fix | RGB 238,237,244 | RGB 30,31,37 | Fails: bar changes only after navigation |
| With background fix | RGB 31,30,36 | RGB 31,30,36 | Passes: identical dark background |

An additional Maestro run edits a controlled draft, switches dark/light/dark, visits Pläne and returns, and selects System. All assertions pass: the edited draft survives both theme and tab changes, and System resolves to dark, matching `adb shell cmd uimode night` (yes).

The automated navigation regression also fails before the fix and passes with it, checking updates in both directions on the same mounted navigator and preserving the iOS default background.

## Native iOS verification

On the iPhone 16 simulator running iOS 26.5, explicit light → dark → light and returning to System all update the native bar without a tab change. Changing the simulator's system appearance to dark while System is selected also updates it. The native bar has a short appearance transition but does not remain stuck as on Android. The inspected recording shows light at 5–9 s, the transition at 10 s, settled dark at 11–14 s, System/light at 16–30 s and System/dark at 31 s. Focused samples around the second explicit switch show intermediate picker positions and icon fades.

The installed development binary required its matching dependency set: Expo/Router 57.0.8, React Native 0.86.0, react-native-screens 4.26.2, Reanimated 4.5.0 and Worklets 0.10.0. It ran the changed source and real local iOS system-appearance bridge. Main's newer JS runtime crashed before mounting this older binary; the temporary dependency substitution was reverted. This verifies this iOS build/version only, not every iOS release or the latest native binary. The simulator's appearance was restored to light after testing.

Coverage: 31.94-second video; 32 full-timeline frames sampled at 1 fps (1-second interval); 2 contact sheet(s); 4 additional frames from 00:00:09.700 to 00:00:10.600 at 30 fps; no audio stream.

Both full-timeline sheets and the focused sheet were inspected. No audio/transcription. The sparse focused extraction confirms intermediate positions but is insufficient for measuring the exact animation duration.

## History and existing work

- The previous custom bottom navigation used the reactive `bg-card` theme color.
- [10ea9d38, 28 July 2026](https://github.com/Dayova/dayova-mvp/commit/10ea9d38d4bac02876374f4f20af74215d419d2d) replaced it with `NativeTabs` without an explicit background. That change entered main on 16 August in [PR #490](https://github.com/Dayova/dayova-mvp/pull/490), merge `6dd10216`. This identifies the code transition that introduced dependence on the native fallback; it is not a device bisect of every historical release or proof of the first affected shipped binary.
- [PR #670](https://github.com/Dayova/dayova-mvp/pull/670), 19 September, simplified/renamed the tabs but did not introduce this missing background binding.
- The picker was static when dark mode was introduced in [070040a6, 14 July](https://github.com/Dayova/dayova-mvp/commit/070040a6cef15f2b6936030ade54573879fe45c2). Missing picker motion is an unfinished interaction, not a removed animation in the inspected history.
- [f92df663](https://github.com/Dayova/dayova-mvp/commit/f92df663fc70f772846254f3bef1b113655fd655) adds a gradient to the selected option in the combined QA branches ([#674](https://github.com/Dayova/dayova-mvp/pull/674), [#702](https://github.com/Dayova/dayova-mvp/pull/702)). It neither animates the selection nor fixes the native background.
- Searches of open/closed GitHub PRs and Linear theme/navbar/dark-mode issues found no existing fix for this exact symptom. DAY-101 is a completed general dark-mode audit; DAY-214 concerns notification filter tabs, not bottom navigation.

## Final automated validation

- `pnpm typecheck`: passed on the final source with the temporary harness removed.
- Focused Jest suites (navigation, settings screen, picker): 13 passed.
- Theme preference and theme CSS Vitest suites: 8 passed.
- Biome and ESLint on all six changed TypeScript files: passed.
- `git diff --check`: passed.

The Jest Reanimated mock checks selection/accessibility and persistent component identity, not frame timing; native recording supplies the visual motion evidence. Temporary entry-point and dependency changes were restored before delivery.
