---
name: expo-native-ui
description: Framework (OSS). Build beautiful, native-feeling Expo screens. Covers Apple HIG styling, semantic colors, native controls, SF Symbols, media, animations, visual effects, gradients, storage, and responsive layout. For routing and navigation, use the expo-router skill.
license: MIT
---

# Expo Native UI Guidelines

For routes, links, stacks, tabs, modals, sheets, and headers, use the `expo-router` skill.

## References

Consult these resources as needed:

```
references/
  animations.md          Select native transitions, Reanimated, or another primitive by behavior
  controls.md            Route controls through Expo UI and repository-specific wrappers
  gradients.md           CSS gradients via experimental_backgroundImage (New Arch only)
  icons.md               SF Symbols via expo-image (sf: source), names, animations, weights
  media.md               Camera, audio, video, and file saving
  storage.md             SQLite, AsyncStorage, SecureStore
  visual-effects.md      Blur (expo-blur) and liquid glass (expo-glass-effect)
  webgpu-three.md        3D graphics, games, GPU visualizations with WebGPU and Three.js
```

## Running the App

**CRITICAL: Always try Expo Go first before creating custom builds.**

Most Expo apps work in Expo Go without any custom native code. Before running `npx expo run:ios` or `npx expo run:android`:

1. **Start with Expo Go**: Run `npx expo start` and scan the QR code with Expo Go
2. **Check if features work**: Test your app thoroughly in Expo Go
3. **Only create custom builds when required** - see below

### When Custom Builds Are Required

You need `npx expo run:ios/android` or `eas build` ONLY when using:

- **Local Expo modules** (custom native code in `modules/`)
- **Apple targets** (widgets, app clips, extensions via `@bacons/apple-targets`)
- **Third-party native modules** not included in Expo Go
- **Custom native configuration** that can't be expressed in `app.json`

### When Expo Go Works

Expo Go supports a huge range of features out of the box:

- All `expo-*` packages (camera, location, notifications, etc.)
- Expo Router navigation
- Most UI libraries (reanimated, gesture handler, etc.)
- Push notifications, deep links, and more

**If you're unsure, try Expo Go first.** Creating custom builds adds complexity, slower iteration, and requires Xcode/Android Studio setup.

## Code Style

- Be cautious of unterminated strings. Ensure nested backticks are escaped; never forget to escape quotes correctly.
- Always use import statements at the top of the file.
- Always use kebab-case for file names, e.g. `comment-card.tsx`
- Never use special characters in file names
- Configure tsconfig.json with path aliases, and prefer aliases over relative imports for refactors.

## Repository Guidance Takes Precedence

- Read `AGENTS.md`, `CONTEXT-MAP.md`, and the relevant repository context before choosing UI primitives.
- Treat repository component and design-system policies as stronger than generic examples in this skill.
- In Dayova app screens, import `Switch` from `~/components/ui/switch` and `DateTimePickerSheet` from `~/components/ui/date-time-picker-sheet`. Do not bypass these wrappers with direct control imports.
- For native Expo UI controls and community-library replacements, use the `$expo-ui` skill. Prefer an existing repository wrapper when one is documented.

## Library Preferences

- Never use modules removed from React Native such as Picker, WebView, SafeAreaView, or AsyncStorage
- Never use legacy expo-permissions
- `expo-audio` not `expo-av`
- `expo-video` not `expo-av`
- `expo-image` with `source="sf:name"` for SF Symbols, not `expo-symbols` or `@expo/vector-icons`
- `react-native-safe-area-context` not react-native SafeAreaView
- `process.env.EXPO_OS` not `Platform.OS`
- `React.use` not `React.useContext`
- `expo-image` Image component instead of intrinsic element `img`
- `expo-glass-effect` for liquid glass backdrops
- `Color` from `expo-router` for native semantic colors, not raw `PlatformColor` (type-safe, auto-adapts to light/dark)
- In SDK 56+, never import from `@react-navigation/*` directly — use `expo-router/react-navigation` instead (covers `@react-navigation/native`, `/core`, `/elements`, `/routers`)

## Responsiveness

- Always wrap root component in a scroll view for responsiveness
- Use `<ScrollView contentInsetAdjustmentBehavior="automatic" />` instead of `<SafeAreaView>` for smarter safe area insets
- `contentInsetAdjustmentBehavior="automatic"` should be applied to FlatList and SectionList as well
- Use flexbox instead of Dimensions API
- ALWAYS prefer `useWindowDimensions` over `Dimensions.get()` to measure screen size

## Behavior

- Use expo-haptics conditionally on iOS to make more delightful experiences
- Prefer native controls with built-in accessibility and interaction feedback. Resolve the concrete component through repository guidance and `$expo-ui`; do not add duplicate haptics to controls that already provide them.
- When a route belongs to a Stack, its first child should almost always be a ScrollView with `contentInsetAdjustmentBehavior="automatic"` set
- When adding a `ScrollView` to the page it should almost always be the first component inside the route component
- Use the `<Text selectable />` prop on text containing data that could be copied
- Consider formatting large numbers like 1.4M or 38k
- Never use intrinsic elements like 'img' or 'div' unless in a webview or Expo DOM component

# Styling

Follow the repository design context and the current platform conventions. Use Apple Human Interface Guidelines on iOS and Material guidance on Android without overriding documented product decisions.

## General Styling Rules

- Prefer flex gap over margin and padding styles
- Prefer padding over margin where possible
- Always account for safe area, either with stack headers, tabs, or ScrollView/FlatList `contentInsetAdjustmentBehavior="automatic"`
- Ensure both top and bottom safe area insets are accounted for
- Follow the repository styling system. In Dayova, use NativeWind semantic tokens for static styling and inline styles only for measured, animated, or native values that cannot be expressed as classes.
- Add motion only when it clarifies hierarchy, continuity, or feedback. Choose the primitive with `references/animations.md` and honor the user's reduced-motion setting.
- Use `{ borderCurve: 'continuous' }` for rounded corners unless creating a capsule shape
- ALWAYS use a navigation stack title instead of a custom text element on the page
- When padding a ScrollView, use `contentContainerStyle` padding and gap instead of padding on the ScrollView itself (reduces clipping)

## Colors

In Dayova, use the semantic palette defined in `src/global.css` and its native runtime mirrors in `src/lib/theme.ts`. Read `docs/contexts/design-system/CONTEXT.md` for the current token contract.

- Do not create a parallel `theme/colors.ts` palette.
- Do not use Android wallpaper-derived dynamic colors for branded Dayova surfaces or controls.
- Use NativeWind semantic classes for static colors and the existing native theme mirror when a native API requires runtime color values.
- Keep colors passed through Reanimated styles static; do not pass `Color` or `PlatformColor` objects into worklet-driven styles.
- Add or change semantic tokens only through an explicit design-system decision.

## Text Styling

- Add the `selectable` prop to every `<Text/>` element displaying important data or error messages
- Counters should use `{ fontVariant: 'tabular-nums' }` for alignment

## Shadows

Use CSS `boxShadow` style prop. NEVER use legacy React Native shadow or elevation styles.

```tsx
<View style={{ boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" }} />
```

'inset' shadows are supported.
