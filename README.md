# Dayova MVP

Dayova is a German-language learning app that turns upcoming exams into a
`Persönlicher Lernplan`, guides learners through `Theorie`, `Üben`, and
`Praxis` sessions, and separately helps them schedule and manage homework.

The app is built with Expo and React Native. Convex provides the backend, Clerk
provides authentication, NativeWind provides styling, and PostHog provides the
optional validation analytics integration.

## Local development

### Prerequisites

- Node.js 24 (the repository currently pins 24.18.0)
- pnpm 10.25.0
- The native toolchain for the target platform: Xcode on macOS or the Android
  SDK and Android Studio
- Access to Clerk and Convex development environments (if you are part of the team, we should give you access to our internal Convex and Clerk teams for various reasons, but you can theoretically build and develop the app without being in them)

This project contains native code and requires an Expo development build; it
does not run in Expo Go.

### Setup

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create `.env.local` using [`.env.example`](.env.example) as the reference.
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is required. The Convex CLI writes the
   local `EXPO_PUBLIC_CONVEX_URL` when the development deployment starts.
   PostHog variables are optional and analytics stays disabled when its API key
   is absent.

3. Build and start the app together with Convex:

   ```sh
   pnpm ios      # macOS only
   pnpm android
   ```

   After a development build is installed, use `pnpm start` to start Metro and
   Convex without rebuilding the native app.

Backend-only secrets, including file-storage and Vertex AI credentials, belong
in the Convex environment rather than in Expo public variables. The commands
and complete variable reference are documented in [`.env.example`](.env.example).

## Platform support

Dayova currently supports native iOS and Android builds in portrait
orientation. The Expo config intentionally excludes web; future web support is
tracked in [DAY-45](https://linear.app/dayova/issue/DAY-45/track-future-web-support).
The iOS app currently requires iOS 17 because of the native Clerk SDK.

## Appearance and dark mode

Light, dark, and system appearance modes are implemented. Learners can choose
`Hell`, `System`, or `Dunkel` under **Settings → Design**, and the preference is
persisted across app launches.

The implementation includes:

- light and dark semantic color tokens for NativeWind;
- matching runtime colors for React Navigation, native component props, the
  root background, and status bars;
- live system-appearance updates on Android and iOS; and
- a local iOS appearance bridge that keeps system mode synchronized across
  cold launch, foreground/background transitions, and OS appearance changes.

Dark mode is functional but not considered complete. The remaining work is a
cross-screen, real-device, and accessibility audit plus known visual cleanup.
The current state is tracked in
[DAY-44](https://linear.app/dayova/issue/DAY-44/dark-mode-support) and the
completion audit in
[DAY-101](https://linear.app/dayova/issue/DAY-101/audit-and-complete-dark-mode-design-system-support).
Known open defects include notification styling
([DAY-214](https://linear.app/dayova/issue/DAY-214/inconsistent-tab-icon-badge-and-typography-styling-in-light-and-dark))
and dark-mode action spacing
([DAY-215](https://linear.app/dayova/issue/DAY-215/inconsistent-spacing-in-dark-mode)).

Theme tokens and runtime colors live in [`src/global.css`](src/global.css) and
[`src/lib/theme.ts`](src/lib/theme.ts). Preference handling lives in
[`src/lib/theme-preference.ts`](src/lib/theme-preference.ts). See the
[design-system context](docs/contexts/design-system/CONTEXT.md) and the
[iOS appearance module guide](modules/dayova-system-appearance/README.md) for
the implementation rules and native validation matrix.

## Project checks

```sh
pnpm check          # lint and TypeScript
pnpm test           # Vitest suite
pnpm format:check   # formatting and Tailwind class order
pnpm check:unused   # unused files, dependencies, and exports
```

## Repository guidance

- [Context map](CONTEXT-MAP.md): architecture and domain documentation
- [Styling guide](docs/styling.md): NativeWind, typography, tokens, and class
  merging conventions
- [Bottom-sheet guide](docs/bottom-sheets.md): shared sheet behavior
- [Release guide](release/README.md): production builds and OTA safety
- [Issue-tracker guide](docs/agents/issue-tracker.md): Linear is the source of
  truth for issues and PRDs; GitHub Issues is the synchronized compatibility
  surface

## Windows Android builds

Windows Android builds require a standalone `ninja.exe` because of the native
CMake path-length workaround in [`plugins/withNinjaLongPaths.js`](plugins/withNinjaLongPaths.js).
Download Ninja from the
[official releases](https://github.com/ninja-build/ninja/releases), then either
place it at `D:\ninja\ninja.exe` or set `NINJA_PATH` to its absolute path. See
the related [Expo issue](https://github.com/expo/expo/issues/36274) for the
underlying limitation.
