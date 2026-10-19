# Topic search latency — 19 October 2026

The user reports searches taking more than two seconds. Reproduced against the
actual WLO adapter at PR #884 runtime revision `460adc61`. **First-time search
speed remains unresolved.** Cache hits, a 120 ms debounce, and previous relative
improvements must not be described as consistently fast topic search.

## Reproduction

Run from the repository root with dependencies installed:

```sh
node scripts/evidence/pr884/search-performance.mjs latency-review /tmp/topic-search-latency.json --prefixes --max-ms=2000
```

This invokes the real adapter with synthetic terms, bypassing Dayova's caches.
The optional budget exits nonzero on a failed search or a result over the stated
duration; it writes evidence before asserting. It is a live diagnostic, not a
deterministic CI test or a new product SLA. Provider caching/load and the network
can change the result. The default six-term benchmark remains available without
`--prefixes`; the environment label now records the actual host platform.

Recorded command output:

| Query / subject | Adapter duration | Completed provider requests |
| --- | ---: | ---: |
| Lin / Mathematik | 3,154 ms | 1 |
| Bil / Mathematik | 7,983 ms | 3 |
| Funk / Mathematik | 2,139 ms | 1 |

The command exited 1: `Provider searches failed or exceeded 2000 ms; inspect the saved report`.
[Raw synthetic evidence](../evidence/pr884/search-performance-prefixes-2026-10-19.json)
contains response timings and public catalog results, with no learner data.

Two preceding direct-adapter runs reproduced the same pattern: Lin 4,235 / 3,777
ms; Funk 2,476 / 3,395 ms; Bil timed out at 8,006 ms, then succeeded at 7,379 ms.
The original six narrower benchmark terms took 605–1,839 ms in this session.
Testing only those terms would miss the broad-prefix problem.

These are macOS Node measurements of complete provider responses and adapter
processing. They exclude the app debounce, Convex transport/cache operations and
native rendering. They do not establish device end-to-end latency, production
percentiles, or an uncached state inside the external provider itself.

## Findings

1. **The first provider response is sufficient to cause the delay.** Lin spent
   3,146 of 3,154 ms in its single request; Funk spent 2,138 of 2,139 ms there.
   Neither case needed another page or typo expansion.
2. **Pagination adds delay for broader terms.** Bil's first response took 4,259
   ms; two subsequent requests overlapped and took 3,718 and 2,003 ms. The adapter
   waits for them before ranking. Cutting pages would change result coverage and
   subject ranking; it is not an equivalent speed fix.
3. **The intended client wait is short, but does not bound total latency.** The
   rendered search regression verifies dispatch within 150 ms after the last
   keystroke, using controlled timers. That does not measure device scheduling,
   backend transport, or external response time. Cache reuse helps only when a
   suitable unexpired result exists.

No runtime search change or backend deployment is included in this follow-up.
The PR must retain first-time latency as an unresolved acceptance item. A durable
approach would investigate a Dayova-served topic index refreshed independently of
typing, with verified catalog coverage and freshness. A longer cache lifetime
alone would still leave first searches exposed to this delay.

## Validation correction

Running the search suite exposed a missing `useKeyboardState` mock after the
keyboard-footer change: 22 tests failed before search assertions could run.
The mock now represents a closed keyboard, matching the existing test setup.
The separate setup suite owns real open/closed-state behavior coverage. This
repairs test execution; it does not change runtime search speed.

After the repair, all 107 UI suites / 597 tests pass, including the search
dispatch, cache, stale-response and keyboard-footer regressions. TypeScript,
changed-file ESLint/Biome, evidence consistency and diff checks pass. The live
two-second performance check remains red, as documented above; this update is
not a performance acceptance or merge-readiness sign-off.
