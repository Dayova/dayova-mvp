# DAY-410: expanded Maestro coverage on Android

Validation on 2026-09-13 for [DAY-410](https://linear.app/dayova/issue/DAY-410),
stacked above PR #556 (`codex/day-314-maestro-smoke`, `c6e3704`).
Application source is unchanged from that parent; this layer changes Maestro
flows and documentation only.

## Environment

- Windows 11, Java 17, Maestro 2.10.0.
- Disposable `Dayova_Maestro_DAY314_API34`, serial `emulator-5584`:
  Android 14 / API 34, Google Play x86_64, 4 GB RAM, four cores,
  1080 × 2400 pixels, density 420, portrait/default text size.
- Existing DAY-314 development-client APK, `com.dayova.dev`, version 1.0.4,
  versionCode 1. SHA-256:
  `dfd803e801285ee34d99878131af838c7412e332d5415023845245afa88d4af2`.
  This is a compatible existing native client, not a new native compile check.
- Current checkout served by a dedicated Metro on port 8094, reached through
  `adb -s emulator-5584 reverse tcp:8094 tcp:8094`. Clerk test-key prefix checked;
  existing DAY-314 development backend configuration retained. PostHog disabled.
  No valid auth submissions or learner credentials are used by the flows.

## Commands and results

Start Metro with the non-production public configuration described in
[testing.md](../testing.md):

```sh
pnpm exec cross-env CI=1 APP_VARIANT=development EXPO_PUBLIC_POSTHOG_API_KEY= expo start --dev-client --minify --port 8094 --lan
adb -s emulator-5584 reverse tcp:8094 tcp:8094
pnpm test:smoke:android --device emulator-5584 -e DEV_SERVER_URL=http://127.0.0.1:8094
```

The final full-suite run used a warm **minified development bundle**
(`dev=true`, `minify=true` in the manifest), with the same native client,
test services, flows and timeouts. It exited **0**, with **4 tests / 0 failures**
in **503.688 seconds**:

| Flow | Seconds | Result |
| --- | ---: | --- |
| App launch and Login → registration | 89.769 | Passed |
| Login validation and password visibility | 148.717 | Passed |
| Onboarding navigation and retained answers | 139.507 | Passed |
| Password recovery validation and cancellation | 125.629 | Passed |

Report: `.maestro/artifacts/android/report.xml`, also attached to DAY-410.
SHA-256: `b0eed904cc48c2742b9af7cc9d7c2fc3146511f2f8576b5dce82813a1df50d2a`.
Per-flow screenshots and command traces are under
`.maestro/artifacts/android/2026-09-13_222956/`.

The focused `--include-tags onboarding` run passed all introduction, name,
duration/day selection and back-retention assertions in **158.150 seconds**.
It used the guarded clean-state bootstrap independently of the suite. Its report
is `.maestro/artifacts/day-410-onboarding-retry/report.xml`. The full suite also
reset between flows ending on different auth/onboarding screens.

`pnpm check` passed (Biome, ESLint and TypeScript). CodeRabbit CLI reviewed the
seven changed flow/helper/documentation files against `c6e3704` with **zero
findings**. The first review attempt was rate-limited; a later attempt completed.

## Failures investigated

The initial four-flow run passed launch, login validation/visibility and recovery.
Onboarding failed at the second intro-page assertion: the screenshot and native
hierarchy showed the disabled-PostHog LogBox banner overlapping the bottom action.
The development bootstrap now opens that exact warning, verifies its message and
dismisses only that entry. With this change, the same intro navigation and the
remaining onboarding checks passed. No app assertion was made optional, no
coordinate tap was introduced, and no timeout was increased.

A focused rerun also timed out waiting for Login while the app surface was blank,
before any new onboarding commands. Metro was warm; `pnpm check` was running
concurrently. The same flow subsequently passed after those checks completed.
The subsequent full development-mode run passed launch (98.238 seconds), login
validation and onboarding, but recovery hit the same startup timeout before its
own UI actions. This does not establish host load as the cause. Follow-up
[DAY-412](https://linear.app/dayova/issue/DAY-412) retains the failure report and
tracks investigation of initialization latency separately from test coverage.

Minification gave a complete passing comparison, but one successful suite does
not establish that the startup issue is fixed. The normal unminified development
path remains intermittent on this host. A `--no-dev --minify` comparison could
not start because local release-required RevenueCat/legal configuration was
absent; those requirements were not bypassed. The successful comparison retained
development mode and used only `--minify`.

Maestro also logged Windows session-heartbeat file-lock warnings during execution.
The native test verdicts and JUnit reports, rather than those warnings, determine
the results reported here.

## Limits and follow-up

This evidence exercises a development client on one Android viewport. It does not
establish a newly built embedded preview, offline operation, authenticated
Clerk/Convex behavior, or a viewport matrix. New iOS journeys still require
[DAY-411](https://linear.app/dayova/issue/DAY-411); the older DAY-314 iOS evidence
covers the original launch/login flow only. Authentication and CI remain DAY-321,
DAY-315 and DAY-316.
