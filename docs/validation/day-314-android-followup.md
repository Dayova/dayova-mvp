# DAY-314 Android check after iOS fixes

Validated on 2026-09-10 against PR #556's shared flow at
`3b5ebc8a3f5670b8d4cc2758c37494f574979618`. Follow-up edits affect documentation
only; the flow and application source were unchanged during these runs.

## Environment and provenance

- Windows, Maestro 2.10.0, Microsoft Java 17, disposable Android 14 Google Play
  x86_64 emulator `Dayova_Maestro_DAY314_API34`, serial `emulator-5584`.
- Four virtual CPUs, 4 GB emulator RAM, 1080 × 2400 pixels, density 420.
- Existing compatible SDK 57 development APK, `com.dayova.dev`, version 1.0.4,
  version code 1. No new native build was produced for this check.
- Retained APK SHA-256:
  `dfd803e801285ee34d99878131af838c7412e332d5415023845245afa88d4af2`.
- Metro served this checkout on port 8094 with `APP_VARIANT=development`, Clerk
  test configuration, Convex `kindred-canary-599` (the dev deployment verified in
  the iOS evidence), and an empty PostHog public key. No learner sign-in occurred.
- The Android manifest identified this checkout's absolute root and runtime
  1.0.4. Its launch bundle contained the expected Clerk test key and Convex URL.
  Bundle SHA-256:
  `ea10ea40f11f50d47bc965588487ed79225d55a25962103f56ad76d23f971a0e`.

## Native results

Every run used the standard driver setup and this command:

```sh
pnpm test:smoke:android --device emulator-5584 -e DEV_SERVER_URL=http://127.0.0.1:8094
```

| Evidence directory under `.maestro/artifacts/android/` | Duration | Exit | Result |
| --- | ---: | ---: | --- |
| `2026-09-10_074934/` | 1m 43s (CLI) | 1 | Cold Metro build exceeded the startup bound |
| `2026-09-10_075302/` | 46.975 s (JUnit) | 0 | All assertions passed with the completed bundle |
| `2026-09-10_075443/` | 39.631 s (JUnit) | 0 | Consecutive pass, resetting from the preceding Login screen |

The initial failure screenshot shows Metro at 72% bundling. Metro subsequently
reported an 81,057 ms transform of 8,032 modules, exceeding the unchanged
60-second development startup wait. The two subsequent runs used that completed
bundle; this establishes warm-cache compatibility, not a successful cold build.
No timeout, selector, or assertion was relaxed.

The updated inner/outer onboarding URL worked on Android. The iOS Open dialog
branch was skipped, welcome animation settling completed, and all real
welcome-to-Login assertions passed. The second Login screenshot was inspected.
JUnit reports, command logs, and screenshots remain in the ignored artifact
directories. Copies of the passing reports and Metro provenance are also under
`.maestro/artifacts/ios-review/`.

This verifies the installed development runtime plus the current Metro bundle;
it does not add Android embedded-preview or EAS automation evidence.

## iOS evidence review and follow-ups

The attached iOS report matched the committed record before documentation
clarification. Its evidence ZIP matched SHA-256
`f75149c51e7cc0bc7dc58866fc0e5a69770d60583bce55010a781ac4d791284a`, and all
152 per-file hashes verified. The retained `real-flow.yaml` matched the PR flow
after normalizing line endings. JUnit reports confirmed both final embedded
passes, both final development-client passes, the SE scrolling pass, and the
controlled missing-control failure described in the [iOS record](day-314-ios.md).

Independent screenshot inspection confirmed the SE legal-text/Login overlap.
[DAY-385](https://linear.app/dayova/issue/DAY-385) now owns that focused repair;
[DAY-194](https://linear.app/dayova/issue/DAY-194) retains the broader visual
matrix and missing-imagery observation. Still images do not establish the
temporal persistence of missing imagery. Existing DAY-312/DAY-316, DAY-380, and
DAY-321 already cover iOS automation, load-sensitive tests, and authenticated
journeys respectively.
