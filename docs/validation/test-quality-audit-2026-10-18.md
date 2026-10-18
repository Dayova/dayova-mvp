# Test-quality audit — 18 October 2026

## Scope and standard

Audited the repository at `b80cf7969f4e6f73bc30b648ab6c4a01adb9040d`: 247 tracked test files across Vitest, Jest, and Node's test runner. The audit combined a TypeScript AST inventory, source/mock inspection, history, complete test runs, and independent reviews. Pattern searches were candidate discovery, not proof of test quality. Also inspected the four Maestro flows and two shared helpers; retained their user-visible behavior assertions and corrected one stale launch-flow heading. These native flows were not executed on a device.

The requested [Matt Pocock video](https://www.youtube.com/watch?v=LlgiOCmFG_w) was identified as *Fixing the PR Bottleneck*. Its captions could not be retrieved; this report does not claim a watched-video transcript. The operational definitions come from Matt's primary [test guidance](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/tests.md) and [mocking guidance](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/mocking.md): test observable behavior through stable public boundaries, keep the expected result independent of the implementation, and avoid coupling assertions to internal structure.

Removed tests that merely restated constants/formulas, inspected source wording, pinned classes/layout/SVG/animation parameters, checked removed filenames, or tested a helper implemented only in the test. Kept domain examples, accessibility state, meaningful consumer-boundary tests, external API contracts, architectural RuleTester checks, and explicit storage/migration/deletion invariants. A mock, test ID, pure function, or raw database read alone does not make a test bad.

## Changes

- Deleted 14 suites consisting of visual implementation checks, Swift-source inspection, duplicate iOS config checks, a test-local package-script parser, and retired-asset checks. Removed similarly weak cases/assertions from mixed suites while retaining their behavior coverage.
- Replaced tautological expectations with independent examples: German transliteration, continuation geometry, pagination, access expiry, plan duration, native build limits, and choice length/count budgets.
- Strengthened result preconditions and allocation checks: notification authorization must return real identifiers, large preparation budgets must allocate their full minutes, continuation blocks must contain the expected fresh tasks, and diagnostic/selection loops have positive preconditions.
- Exercised real controls for notification categories and confirmation cards, accessible loading status, large-text continuation, and failed preparation requests.
- Read subject/calendar changes through public Convex queries where those are the app-facing contract. Retained raw storage checks for fields not exposed publicly and for cascading deletion/integrity.
- Executed the actual OTA source guard against a disposable Git repository, including unmerged, missing, and malformed commits. Retained semantic workflow trust wiring. Resolved Expo configuration instead of scanning source strings; validated the real Expo skills updater instead of its prose.
- Moved analytics type assertions to a compile-only file. Removed irrelevant ordering of independent diagnostic calls and federal-state presentation order.
- Added a lazy Jest adapter that loads real Hugeicons assets individually, preserving the real icon wrapper/SVG behavior. Bounded Vitest to four workers to avoid many-core CPU contention. Added explicit time bounds to expensive Expo subprocess checks.
- Added a manual, validation-only EAS benchmark with the same Node/pnpm versions and runner class as CI. It has no deployment or publication job.

## Why these tests accumulated

These are evidence-backed contributing conditions, not claims about an individual agent's private reasoning:

1. **Visual changes were given code-shaped proxies.** [DAY-394's evidence](../qa/day-394-settings-borders/README.md) explicitly records before/after rendered class assertions as the automated border check, with full native acceptance still open. The suite arrived in [926d56fd](https://github.com/Dayova/dayova-mvp/commit/926d56fd). Class checks establish implementation agreement, not visible borders or layout.
2. **The source-scan exception was too broad.** The testing guide's asset/config/generated-contract exception dates to [6d86939f](https://github.com/Dayova/dayova-mvp/commit/6d86939f). Native appearance string checks grew alongside platform fixes starting with [73834a8a](https://github.com/Dayova/dayova-mvp/commit/73834a8a). Windows/native execution constraints are a plausible reason for source checks, but history alone cannot establish the author's intent.
3. **The validation machinery became its own subject.** [f99bf4c7](https://github.com/Dayova/dayova-mvp/commit/f99bf4c7) extended a parser living only in `package-scripts.test.ts`. [1cd24e71](https://github.com/Dayova/dayova-mvp/commit/1cd24e71) introduced skill-composition checks that later pinned prose and patch contents. Neither test proves the real consumer works.
4. **Green checks were insufficient review evidence.** The existing [deep UI seams ADR](../contexts/mobile-app/adr/0002-deep-ui-seams-and-behavior-tests.md) already rejects source tests for interactions. The missing operational check was: which plausible fault fails this test, and which harmless refactor leaves it green? Constant-derived expectations, empty loops, and stale test names escaped that check.

`AGENTS.md` and [the testing guide](../testing.md) now require a requirement, independent oracle, plausible fault, and public seam; distinguish real configuration interoperability from source snapshots; direct visual claims to device evidence; and require a focused fault check when strengthening a weak test. They explicitly allow testing a real consumer's handling of an external response. No upstream skill or local skill overlay was edited.

## Validation and fault checks

The cleaned suite passes: **133 Vitest files / 1,050 tests**, **96 Jest suites / 496 tests**, and **18 Node tests**. This is 233 runtime test files and 1,564 executed tests, versus 247 files and 1,645 tests before. Counts describe scope, not a quality score. TypeScript and both linters pass; a final unused-import warning from removed wrapper queries was removed. The latest calendar-range and independent-date changes also passed 67 focused tests.

Four temporary faults were injected individually, each focused runner exited 1 for the intended failed assertion, and the exact implementation bytes were restored in `finally`:

| Fault | Test that caught it |
| --- | --- |
| Replace German repair with identity | Transliterated German must become the independent expected umlaut text |
| Return no local-notification authorizations | Reused registration IDs must be nonempty strings before equality |
| Allocate only one valid 10-minute slot for a 2,700-minute budget | Allocation must sum to 2,700 minutes, beyond merely passing slot validation |
| Bypass Git ancestry validation | A real unmerged commit must be rejected without publishing an output SHA |

All 51 tests in those four files passed after restoration. The notification fault fails at the string precondition (`toMatch` received `undefined`), rather than falsely passing `undefined === undefined`. The original text-repair, notification-reuse, and large-budget tests each passed under the corresponding faulty implementation; the strengthened tests fail. The original budget test already rejected an empty schedule through its validator, so the useful counterexample is valid but severely underallocated time. These are targeted fault checks, not a claim of exhaustive mutation coverage.

CodeRabbit CLI completed review of the implementation/configuration diff with two minor findings. The calendar helper was expanded from four dates to the complete fixture window through the exam. Its suggested 10/20-minute onboarding cases were rejected: the current supported options are 15, 30, 45, 60, 90, 120, 150, 180, 210, and 240 minutes, independently enumerated in the test. The final independent Standards/Spec findings were addressed, including continuation uniqueness and workflow trust wiring.

All six Maestro YAML files parsed successfully. Its corrected heading matches the current onboarding screen and the passing rendered onboarding journey; native execution remains unverified. The final press-feedback naming follow-up was validated with focused callback tests.

No product implementation changes belong to this audit. Native visual acceptance was not substituted with new prop or source assertions.

## Performance method

Use the same `scripts/benchmark-checks.mjs` harness on both revisions: lint once, typecheck once, then three sequential complete `pnpm test` runs. Compare first runs separately from the median of warm runs 2–3. The change includes cleanup **and** test-harness improvements; its speedup cannot be attributed solely to deleting tests.

Baseline measurement commit `51dc77d1` contains only the harness/workflow on top of the original application/tests. [Baseline EAS run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14ec5-7368-7ffc-9653-d08a1db58f7e), Linux medium, Node 24.18.0, pnpm 11.15.1:

[After EAS run](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14ee1-e2f4-7e26-aee3-2ec862a00bde), cleanup revision `e50142ce`, same workflow/tools/runner class, all stages successful:

| Stage | Before (s) | After (s) | Observed change |
| --- | ---: | ---: | ---: |
| Lint | 23.190 | 26.152 | +12.8% |
| Typecheck | 11.781 | 13.344 | +13.3% |
| Tests, first run | 219.352 | 95.216 | -56.6% |
| Tests, warm run 2 | 72.697 | 74.885 | |
| Tests, warm run 3 | 72.499 | 74.866 | |
| Tests, warm median | 72.598 | 74.875 | +3.1% |
| Lint + typecheck + first test command | 254.324 | 134.712 | -47.0% |
| Entire three-test benchmark job, including setup | 439.050 | 327.709 | -25.4% |

**The improvement is first-run setup/transform time, not warm throughput.** First Jest execution fell from 166.838s to 41.729s; warm Jest was 20.331/20.144s before and 21.705/21.631s after. Vitest remained about 47s. Warm full-suite time was slightly worse in this experiment. Lint/typecheck have one sample per revision; two warm samples do not establish statistical significance or a durable regression. Do not claim that fewer tests made every CI stage faster.

The whole benchmark job intentionally runs tests three times, so its wall time is not normal single-run CI latency. The lint + typecheck + first-test row excludes installation/queueing. Raw per-command records, revisions, job elapsed times, and local samples are in [the timing data](test-quality-audit-2026-10-18.timings.json).

The ordinary successful baseline CI [checks job](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a14c33-d337-76ca-8d6d-a55ec4d010c4) took 351.238 seconds including setup; its test step took 269.909 seconds. This is context, not the matched experiment. A manual invocation of the normal workflow skipped its GitHub-event-conditioned checks and was excluded; that is why the dedicated benchmark exists. No production deployment was launched for this experiment.

Local initial default-worker attempts had timeouts; the original Jest barrel import also stalled long enough to require termination. Failed runs are not successful baseline timings. Completed controlled local comparisons are reported separately below. Device/UI layout, native performance, deployments, and end-to-end release duration are outside this benchmark.

## Local comparison with a common harness

The original and cleaned test files were run sequentially on the same Windows host, both using the new four-worker Vitest configuration and real-asset Hugeicons adapter. Original test files were restored only temporarily, and the cleaned files were restored byte-for-byte in `finally`. Node 24.18.0, pnpm 11.15.1; six successful full `pnpm test` commands:

| Trial | Original tests (s) | Cleaned tests (s) |
| --- | ---: | ---: |
| First | 202.198 | 114.953 |
| Warm 2 | 124.336 | 147.369 |
| Warm 3 | 118.484 | 120.616 |
| Warm median | 121.410 | 133.992 |

Observed warm change: **+10.4%**, not an improvement. The host was shared and the order was not randomized; compilation/cache history makes the first samples unsuitable for isolating cleanup. The second cleaned run alone spent 69.02s in Vitest versus 48.31s in the first, with transform time 22.87s versus 5.24s. Variation is concentrated in transforms/imports as well as execution, so these samples cannot establish a causal warm regression. They do not support a local warm-speedup claim either.

The reproducible cloud result is substantially faster first-run validation with roughly unchanged/slightly worse warm throughput. Test quality, rather than warm runtime reduction, is the reason to keep the cleanup.

## Standards

**Unresolved Standards findings: 0.** Both feedback-test names now match their assertions. The report separates first-run gains from slower warm samples, identifies harness changes as part of the comparison, and limits fault-check and native-validation claims appropriately. Reported timings and percentages agree with the supplied JSON.

Limits: read-only review; timing logs and remote execution were not independently rerun by this reviewer.

## Spec

**Unresolved Spec findings: 0.** The completed report and matching timing data satisfy the outstanding measurement requirement. They distinguish faster first-run CI tests from slightly slower warm runs and disclose the noisy local slowdown, without claiming a uniform speedup.

Limits: small samples, combined cleanup/harness effects, unexecuted native flows, and targeted rather than exhaustive fault coverage. No edits or tests were performed during the final review check.

Unresolved findings: **Standards 0; Spec 0**. [Draft PR #901](https://github.com/Dayova/dayova-mvp/pull/901) contains the changes and evidence. The measured cleanup revision is `e50142ce`; the subsequent evidence follow-up renames two test descriptions and corrects a Maestro heading outside `pnpm test`, without changing the measured test behavior or harness.
