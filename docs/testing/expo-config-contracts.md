# Expo configuration contract tests

The iOS privacy, authentication-capability, Apple-sign-in, and OTA contract
tests assert against real `expo config` output. Vitest resolves the three unique
configurations once in the `expo-config-contract` project and shares the
snapshots with its test workers. The real Metro configuration probe for the
Watchman opt-in runs in the same setup, after the Expo configurations.
Resolution is deliberately serial so a full test run cannot start several
memory-heavy configuration processes at once.

Each child process has a 60-second timeout, a 20 MiB output bound, and an
explicit termination signal and a hidden process window on Windows. The timeout
is scoped to the Expo and Metro setup probes; normal unit-test timeouts are
unchanged. It is twice the roughly 27–30 second
per-process duration observed on the loaded Windows development host in DAY-380.

OTA preflight rejects missing workflow fingerprints before reading the baseline
or starting Expo. Its regression tests cover both platforms and verify that no
child process starts for missing inputs. The production-manifest assertions
still use the real shared Expo output. This avoids a redundant config process
inside an ordinary five-second unit test.

Local measurements on macOS before this change showed five concurrent config
processes finishing in 2.6–3.8 seconds each. A sequential cold resolution of the
three unique contracts took 8.0 seconds total. The setup prints each duration so
Windows and CI evidence can be attached without adding a benchmark-only test.
After the change, the full 116-file Vitest suite passed in 15.13 seconds with
default parallelism and in 20.19 seconds with two workers; the isolated OTA file
passed all 29 tests in 12.81 seconds.

For a resource-constrained machine, run only these contracts with:

```sh
pnpm test:unit:expo-config
```

For the complete Vitest suite, use `pnpm test:unit:vitest`. Reducing the full
suite to two workers remains supported when an emulator or native build is also
running:

```sh
pnpm exec vitest run --maxWorkers=2
```

Require repeated full-suite runs on Windows under representative
native-development load when changing these contracts. Do not replace that
evidence with isolated-file results. Record concurrent workloads alongside
timings, and verify the EAS/Linux check against the same commit.

## Windows validation, 21 September 2026

The initial Windows acceptance run exposed two remaining five-second OTA test
timeouts (6.8–9.3 seconds) while Android bundling was active. Checking missing
fingerprints before config resolution and moving the Metro probe into setup
removed both slow paths from test workers.

After these fixes, two default-parallelism `pnpm test` runs passed all 765
Vitest, 18 tooling, and 271 UI tests in 121.07s and 105.57s wall time. Both ran
alongside an Android emulator and a fresh `expo export --platform android --dev
--clear --max-workers 2`; the Vitest stages took 24.25s and 29.59s. The host was
Windows 11 Pro, Ryzen 5 5600X, 32 GiB RAM, Node 24.18.0, pnpm 11.15.1.
The two-worker Vitest invocation also passed all 765 tests in 47.65s.

The focused contracts passed 35 tests, including regressions that reject either
missing platform fingerprint before starting a child process. The latest
integration and EAS/Linux results are recorded on [PR #662](https://github.com/Dayova/dayova-mvp/pull/662).
