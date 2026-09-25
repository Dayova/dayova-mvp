# Shared simulator QA — 2026-09-25

## One runtime for both devices

Both iPhone and Android must use Metro **8088** from
`output/routine-combined-qa`, branch `codex/combined-simulator-refresh-20260925`.
Never leave either shared simulator connected to an isolated PR server after a test.
The isolated 8091 (#655) and 8092 (#652) servers were stopped during this repair.

Source baseline: `edb752748750c9280bf3e407fbe344e38287309d`.
Updated application source: `ecf4675c`.

## Included scope

This preserves the existing #712/#720 integration: #651, #652, #653, #655,
#656, #661, #662, #693, #707, #708, #709, #710, #711, #719,
#701, #703, #700, #694, native entry navigation #698/#722 and #721/#723.
Registration-back #658 and material recovery #659 are present in the baseline history.

Later integrated changes remain: popup #726/#727/#729, agenda #731,
material postponement #733, creation pause #735, white swipe trash #737,
and voluntary learning routine #742 (follow-up to #651).

This refresh additionally ports #652's Galerie wording (`32b9ce6d`)
and #655's exam-type dialog (`6dbd9610`) and keyboard-aware input (`2fc14c8f`).
Conflict resolutions retain the integrated structured material errors,
dynamic popup sizing, accessible modal isolation, cancel styling,
single-step personal-subject creation and native input metrics.

**Podcast #717 is excluded.** This is the established QA scope, not a claim
that every unrelated open repository PR, prototype or CRM integration is included.

## Validation and limits

- TypeScript passed.
- Complete UI run: 87 suites / 408 tests passed.
- Focused dialog, subject and gallery tests: 4 suites / 45 tests passed.
- Original full keyboard images copied by the cherry-pick remain evidence of
  isolated #655, not evidence of this merged runtime.
- No production merge, OTA, backend deployment or changes to account data.
- Starting this runtime is not full device acceptance of all integrated features.

## Reconnect without deleting data

Start with `APP_VARIANT=development`, the existing QA environment and:

```sh
expo start --dev-client --port 8088 --lan --clear
```

Use the same development URL on both devices:
`exp+dayova://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8088`.
Android also needs `adb reverse tcp:8088 tcp:8088`.
Do not launch the podcast checkout or an isolated PR checkout for shared testing.
