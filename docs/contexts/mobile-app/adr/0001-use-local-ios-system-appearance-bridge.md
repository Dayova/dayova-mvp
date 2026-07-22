# ADR: Use a Local iOS System-Appearance Bridge

- Status: Accepted as a temporary compatibility workaround
- Date: 2026-07-19
- Delivery: [PR #300](https://github.com/Dayova/dayova-mvp/pull/300)
- Operational documentation:
  [`modules/dayova-system-appearance/README.md`](../../../../modules/dayova-system-appearance/README.md)

## Context

Dayova supports Light, System, and Dark appearance preferences. One resolved
`"light" | "dark"` value must keep Dayova's JavaScript theme context,
NativeWind variables, React Navigation colors, UIKit controls, native sheets,
root background, and status bar synchronized.

The standard solution is Expo's `userInterfaceStyle: "automatic"` together
with React Native's public `Appearance` or `useColorScheme` APIs. During native
validation of the Expo SDK 57 / React Native 0.86 upgrade on the installed iOS
26.5 simulator, React Native's appearance value was stale during cold launch
and live system appearance changes while the active `UIWindow` had already
adopted the correct UIKit trait. Depending only on the cached React Native value
made different app layers disagree about the current theme.

Final Debug and optimized Release validation at commit `7856a6e` exposed two
additional presentation gaps. A cold launch while iOS was already Dark used the
Light launch-screen background, and iOS briefly presented its previously saved
app-switcher snapshot after a background appearance change. The former is an
Expo splash configuration problem. The latter happens before React can paint
the resumed theme, so a JavaScript-only foreground update cannot prevent it.

React Native 0.86's pinned iOS source keeps a cached color scheme in
`RCTAppearance`. It refreshes that cache when it receives
`RCTUserInterfaceStyleDidChangeNotification`. Its native resolver can use either
the trait collection supplied with a notification or the key window's trait
collection when key-window mode is enabled.

That source behavior explains why the selected workaround changes Dayova's
result. It does not prove a universal React Native 0.86 defect. The investigation
did not produce a minimal standalone React Native reproduction, and the issue
was observed on one upgraded native stack.

## Decision

Use a local, iOS-only Expo module named `DayovaSystemAppearance` as a narrow
compatibility layer.

The module:

- reads `traitCollection.userInterfaceStyle` from Dayova's active key window;
- attaches a non-interactive UIKit view to that window to observe live trait
  changes;
- exposes a synchronous `getColorScheme(): "light" | "dark"` method and an
  `onChange` event;
- exposes that native state to React through `useSyncExternalStore`, including
  React's post-subscription snapshot check;
- refreshes the value when the app becomes active;
- enables React Native's key-window appearance mode and refreshes
  `RCTAppearance` during module creation and foreground activation;
- covers the application with a non-interactive, accessibility-hidden Dayova
  snapshot shield before iOS captures its background snapshot, then removes the
  shield only after the resumed React appearance has committed;
- is discovered through Expo Autolinking rather than hand-edited into the
  generated Xcode project; and
- remains private to Dayova instead of becoming a published general-purpose
  package.

The application layer continues to own preference persistence, theme
resolution, NativeWind variables, navigation colors, root background, and
status-bar styling. Android and web continue to use React Native's standard
`useColorScheme` path.

Separately, the Expo splash-screen configuration defines Light and Dark native
backgrounds. The Dark value must remain aligned with Dayova's dark root
background token so cold launch never substitutes a white native screen while
the JavaScript bundle starts.

Expo Updates 57.0.9 also needs a narrow dependency patch for its Release-only
deferred root. That path instantiates the splash storyboard before it joins the
active window hierarchy, so UIKit otherwise resolves the dynamic background
with the default Light trait. The patch applies the active window style to the
deferred splash and React root and resolves the root background with that same
trait collection.

The module pod targets iOS 16.4 to preserve Expo SDK 57's module baseline. The
generated Dayova application still targets iOS 17 because `@clerk/expo`
independently requires and writes that target. This module does not establish
the app-wide minimum.

## Decision History

1. `86364a1` introduced the module after the stale React Native appearance value
   was observed. The app config changed from fixed Light to `automatic`, and the
   iOS application hook began reading the key window through the module.
2. `687970c` enabled React Native's key-window appearance mode, added native
   appearance refreshes during creation and activation, and replaced the
   NativeWind preference setter with React Native's public
   `Appearance.setColorScheme` API.
3. `73834a8` restored the module's independent iOS 16.4 compatibility by gating
   the iOS 17 trait-registration API and retaining the older-iOS callback.
4. The DAY-109 follow-up changed the JavaScript adapter to
   `useSyncExternalStore`, made foreground activation retry installation on the
   current active window, and added behavioral plus native-contract regression
   tests for both races.
5. Final native verification at `7856a6e` proved that both Debug and optimized
   Release still showed a Light native splash during Dark cold launch and an
   old-theme iOS snapshot during resume. The follow-up added an Expo Dark splash
   configuration plus a lifecycle snapshot shield. `onResume` now acts as a
   commit handshake: native code refreshes appearance first, React commits the
   resulting state, and JavaScript then releases the shield using the native
   generation carried by the acknowledgement. Stale generations cannot remove
   a newer shield during rapid lifecycle transitions.
6. Frame-by-frame verification of the later SDK 57 Release build found one
   remaining Light frame in Expo Updates' deferred root path. A pinned
   `expo-updates@57.0.9` patch now resolves that storyboard and root background
   with the active window's trait collection before either can be displayed.

Native validation ran on an iOS 26.5 simulator. Debug and optimized Release
compiled the module for `arm64-apple-ios16.4-simulator`, but no iOS 16.4 runtime
was installed. The minimum OS therefore has compile coverage, not end-to-end
runtime coverage.

## Alternatives Considered

Repository history establishes that the standard React Native and NativeWind
paths were actually used before the local module. The remaining entries record
the design space evaluated for maintenance; they are not claims that every
option was prototyped during the original investigation.

| Option | Status | Assessment |
| --- | --- | --- |
| React Native `useColorScheme` / `Appearance.addChangeListener` only | Used and preferred when reliable | This remains the normal non-iOS path. It was insufficient on the validated React Native 0.86 iOS stack because its value was stale. It is the desired replacement when it passes Dayova's matrix. |
| NativeWind `useColorScheme` | Used before the workaround | NativeWind delegates to native appearance APIs, so it was not an independent source when React Native's value was stale. Its preference setter was replaced with the public `Appearance.setColorScheme` call. |
| Expo `userInterfaceStyle: "automatic"` | Implemented and required | This configures the native app to support both styles. It is a prerequisite rather than a replacement for correct runtime observation. |
| `expo-system-ui` | Already used for root background behavior | It manages system/root presentation but is not an independent live key-window appearance source for the Dayova theme provider. |
| Refresh only on app foreground | Rejected | It would repair some resume cases but miss live system changes while Dayova remains foregrounded. |
| Poll the appearance value | Rejected | Polling adds work and latency. Polling React Native preserves the stale source; polling UIKit still requires native code. |
| Remove System or force a fixed theme | Rejected | It avoids observation by removing an existing product capability and is a larger user-facing regression than the bridge. |
| Patch React Native or edit generated iOS files | Rejected | Either has a wider blast radius and a heavier upgrade burden. A local module isolates the workaround and survives continuous native generation, although its React Native coupling still needs upgrade review. |
| AppDelegate/config-plugin integration for appearance observation | Rejected | An app lifecycle subscriber can refresh on activation, but live observation still requires a UIKit trait environment and a JavaScript bridge. The snapshot shield uses `UIApplication.willResignActiveNotification` inside the existing module instead of adding generated AppDelegate wiring. |
| `DynamicColorIOS` or semantic platform colors | Insufficient | Dynamic native colors can adapt independently, but Dayova's custom tokens, navigation themes, NativeWind variables, and application logic still need a resolved theme value. |
| Upstream React Native fix | Preferred long-term outcome | Remove the module once the public React Native path reliably returns and publishes Dayova's active key-window appearance across the supported iOS matrix. No upstream issue or patch is recorded by this repository yet. |

## Consequences

Positive consequences:

- Dayova has one direct iOS source for the active window appearance.
- Live system changes, app overrides, and foreground restoration can keep theme
  consumers synchronized.
- The workaround is isolated in one local module and one platform adapter.
- Native regeneration requires no manual Xcode edits.
- Dark cold launch uses the same background family as Dayova's Dark UI, and a
  stable branded snapshot replaces stale theme content during resume.

Costs and risks:

- The module uses `RCTUseKeyWindowForSystemStyle` and native React appearance
  notification behavior, which are not part of the documented JavaScript API
  contract and may change during upgrades.
- Active-window lookup assumes Dayova's current single-window app model.
- The first observer installation still depends on an active window. If no
  window exists yet, foreground activation retries installation; a future
  multi-window product would still need scene-specific ownership.
- Initialization, trait changes, and foreground refreshes can emit duplicate
  state values, so consumers must remain idempotent.
- iOS may briefly show the branded shield during background and foreground
  transitions. This is intentional: keeping it until React acknowledges a
  committed resume is safer than revealing stale theme content or removing it
  on an assumed native timing boundary.
- The Expo Updates patch is version-pinned maintenance work. It must be
  revalidated on every Expo Updates upgrade and removed once upstream resolves
  deferred splash colors with the active window trait.
- The module's iOS 16.4 compatibility is compile-tested but cannot be launched
  at that floor while Clerk requires the app to target iOS 17.

## Validation and Removal

The module README owns the operational build, smoke-test, troubleshooting, and
maintenance instructions. Source-shape tests protect a few implementation
markers, but only native Debug/Release builds and runtime smoke tests validate
UIKit behavior.

Review this decision on every Expo SDK, React Native, or minimum-iOS upgrade.
Remove the bridge when React Native's public appearance path passes all of these
without the module:

1. cold launch in Light and Dark;
2. live system Light/Dark changes with Dayova foregrounded;
3. Dayova's explicit Light, System, and Dark overrides;
4. background/foreground appearance restoration;
5. Dark cold launch without a Light native splash and resume without an
   old-theme app snapshot;
6. synchronized NativeWind, navigation, root, native-control, sheet, and status
   bar appearance; and
7. Debug and embedded-bundle Release execution across the supported iOS matrix.

## Primary References

- [Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes/)
- [Expo splash screens and app icons](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [Expo SplashScreen API and config plugin](https://docs.expo.dev/versions/latest/sdk/splash-screen/)
- [React Native Appearance](https://reactnative.dev/docs/appearance)
- [React Native useColorScheme](https://reactnative.dev/docs/usecolorscheme)
- [Expo local modules](https://docs.expo.dev/more/create-expo-module/)
- [Expo Autolinking](https://docs.expo.dev/modules/autolinking/)
- [Apple: registerForTraitChanges](https://developer.apple.com/documentation/uikit/uitraitchangeobservable-67e94/registerfortraitchanges%28_%3Ahandler%3A%29)
- [Apple: adapting when traits change](https://developer.apple.com/documentation/uikit/adapting-your-app-when-traits-change)
- [Apple: `willResignActiveNotification`](https://developer.apple.com/documentation/uikit/uiapplication/willresignactivenotification)
