# Expo configuration contract tests

The iOS privacy, authentication-capability, Apple-sign-in, and OTA contract
tests assert against real `expo config` output. Vitest resolves the three unique
configurations once in the `expo-config-contract` project and shares the
snapshots with its test workers. Resolution is deliberately serial so a full
test run cannot start several memory-heavy Expo config processes at once.

Each child process has a 60-second timeout, a 20 MiB output bound, and an
explicit termination signal. The timeout is scoped to Expo config resolution;
normal unit-test timeouts are unchanged. It is twice the roughly 27–30 second
per-process duration observed on the loaded Windows development host in DAY-380.

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

DAY-380 is not fully validated until repeated full-suite runs pass on Windows
under representative native-development load. Do not replace that evidence
with isolated-file results.
