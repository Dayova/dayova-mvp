# DAY-525 — native iOS sheet close controls

Follow-up to merged PR #869, based on main merge commit
`8b9b8af557ca581f71e91653a87003447551d762`.

## Change and scope

The shared sheet frame now uses `SheetCloseButton` in both its normal header
row and its separate close row at large text sizes. On iOS this delegates to
`NativeNavigationIconButton`, extracted from the existing creation-header
implementation. iOS 26+ selects the native `glass` button style; older iOS
selects `bordered`. Both retain the 48pt host, themed 20pt Hugeicon and native
disabled behavior. Contextual sheet labels/hints and dismissal remain owned by
the caller. The creation header retains its existing navigation hints.

Android/web delegate to the existing `CloseButton`. No sheet presentation,
navigation, save/confirmation policy, dependency, native module or release
configuration changes are included.

## Checks

- Four focused UI suites: **28 tests passed**. Coverage includes the iOS 26,
  26.5 and older-version selection at the native boundary, contextual labels
  and hints, enabled/disabled dismissal, app theme changes, 48pt hosts,
  Android/web fallback, sheet lifecycle/large-text layout and creation-header
  dispatch. The native boundary is modeled; these tests do not render glass.
- TypeScript, targeted ESLint/Biome and diff checks passed.
- Independent standards and specification reviews found no actionable issues.
- CodeRabbit CLI completed its review with zero findings.
- A broader local UI run was stopped after 13 passing suites when it stopped
  making progress at the unchanged preparation-slot editor suite. It is not
  reported as a complete full-suite pass. Cloud CI is tracked on the PR.

## Native evidence limitation

This Windows host has no local iOS simulator. The repository's EAS Simulator
workflow was checked with current EAS CLI 25.0.0. An actual iOS session request
returned: “EAS Simulator isn't available on dayova yet — it's coming soon.”
The account is on the service's availability/waitlist boundary, so no remote
session or native rendering was available. No screenshot or recording of the
new iOS implementation is claimed or fabricated. No production account,
backend data, OTA publication or app deployment was used.

Before visual approval, capture real before/head iOS 26+ sheets in light/dark,
normal/large text, verify X dismissal and non-dismissible/busy behavior,
inspect VoiceOver labels/focus return, and check older iOS fallback. Upload
evidence through `gh pr comment --attach` and link it directly in the PR;
do not add image/video binaries to the repository.

Reference: [Expo SwiftUI Button documentation](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/button/).
The installed `@expo/ui` version is 57.0.16; its actual modifier/component types
were consulted before implementation.
