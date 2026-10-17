# Topic search performance — 17 October 2026

Follow-up to PR #884 at `863613aa`, requested after the native acceptance run.
The interaction remains checkbox selection, persistent removable chips and an
independent optional additional-information field. This is a technical latency
improvement, not evidence that the student hypothesis is validated.

## Measured feedback loops

Before implementation, the rendered search test failed: no action had started
150 ms after the final keystroke. Two further regressions reproduced a delayed
normalized cache hit and a duplicate request when returning to a pending query.
The narrow-query preview and backspace/provider-failure regressions also failed
before their fixes. Run the real component seam with:

```sh
node node_modules/jest/bin/jest.js --runInBand src/features/learning-plans/topic-search.ui.test.tsx
```

The provider probe wraps the actual adapter's fetch calls, measuring complete
response downloads and decoded response bytes, not just headers. It does not
include Convex transport, debounce or device rendering. Run at each source
revision with synthetic terms:

```sh
node scripts/evidence/pr884/search-performance.mjs after /absolute/path/report.json
```

The script was added by this follow-up; use a saved copy when running against
the baseline checkout. Do not reset an active checkout to reproduce a baseline.

| Synthetic search | Previous adapter (ms) | New adapter (ms) |
| --- | ---: | ---: |
| Bilanz / Rechnungswesen | 2,641 | 1,913 |
| Gedicht / Deutsch | 1,395 | 657 |
| Vektor / Mathe LK | 1,659 | 814 |
| Klima / Erdkunde | 3,113 | 2,178 |
| Zelle / Biologie | 1,189 | 958 |
| Demokr / Sozialkunde | 4,107 | 1,854 |

The six-case median fell from **2,150 to 1,406 ms** (about 35%); decoded provider
payload fell from **487,730 to 269,540 bytes** (about 45%). These are one before
and one after run, not a population percentile, randomized benchmark or SLA.
Connection reuse, external load and provider caches affect timing. In an
additional alternating Bilanz probe the old endpoint took 1,861 / 970 ms and
the metadata endpoint 747 / 561 ms.

Every displayed title, order, merged subject label and additional/context flag
was equal across these six full results. Two duplicate-title representative
provider IDs differed in Klima; provider IDs are not persisted as chosen topic
identity, and normalized complete titles still control selection/removal.

An actual Clerk test sign-in, including the normal device-trust verification,
then called the development Convex action through ConvexHttpClient. First
observations took 1,546 ms (Bilanz), 1,490 ms (Gedicht) and 589 ms
(Skalarprodukt). The following two calls per term took **82–226 ms**, median
143 ms, with equal titles. These are HTTP action round trips; they exclude
debounce and native rendering. No administrative synthetic identity was used
for this latter measurement, and no token or credential is in the evidence.

Public synthetic measurement files:
[provider before](../evidence/pr884/search-performance-before.json),
[provider after](../evidence/pr884/search-performance-after.json),
[authenticated development action](../evidence/pr884/search-performance-action.json).

## Decisions and tradeoffs

- **120 ms debounce instead of 350 ms.** Keep a short typing burst coalesced,
  remove 230 ms of fixed wait, and retain the three-character minimum. No
  requests are emitted from the note editor.
- **Immediate exact local hits; share in-flight requests.** Normalize case,
  Unicode, whitespace and the existing Gedichtsanalyse alias. Retain completed
  results even if the query changed while the response was in flight, without
  rendering a stale result under a new key. Evict one oldest entry rather than
  clearing the entire 30-entry cache.
- **Known matching titles as a preview.** Filter only current-term title
  matches from fresh same-subject local entries, deduplicate by complete title
  and use the same rank function as the backend. Refresh even if the broad
  source was complete: the provider can return additional narrow-query matches.
  Never turn an empty preview into a false no-results answer. Backspace also
  reuses known titles. A failed refresh retains those valid choices and shows
  the existing recoverable error/retry beside them. No text is inserted in notes.
- **Supported provider endpoint, smaller property set.** The provider's
  [CollectionApi](https://github.com/edu-sharing/edu-sharing-community-repository/blob/master/Backend/services/core/src/main/java/org/edu_sharing/restservices/collection/v1/CollectionApi.java)
  explicitly deprecates collection search and materializes all properties.
  Its [SearchApi](https://github.com/edu-sharing/edu-sharing-community-repository/blob/master/Backend/services/core/src/main/java/org/edu_sharing/restservices/search/v1/SearchApi.java)
  supports the same collections query with property filters. Request both
  `ccm:taxonid` and its display label, preserving context. No speculative
  spelling, username or collection resolution is needed.
- **Bounded concurrent pagination.** A valid total avoids an unnecessary empty
  last page. At most two subsequent pages overlap, and merging keeps page order.
  Still at most five provider requests, 500 candidate nodes, 20 returned titles,
  five visible titles and the original eight-second deadline. Abort remaining
  in-flight fetches on failure. Missing totals retain the previous safe loop.
- **Shared server cache.** One indexed read and, on a miss, one bounded write;
  no scans, cron, new dependencies or migration of learner records. The full
  SHA-256 digest includes the version, normalized query and sorted resolved
  context. A two-hex-digit slot bounds storage to 256 records, with digest
  comparison before reuse. Collisions cause eviction/misses only. Raw terms,
  arbitrary subject names, account identifiers and notes are not stored. A
  digest is not an anonymity guarantee for a small guessable vocabulary.
  Check authentication before access, expire in the action, cache only successful
  responses and treat cache infrastructure as optional. Empty successes can be
  cached; provider failures cannot. Cache entries expire after five minutes per
  layer, so layered client/server use can produce nearly ten minutes of catalog
  staleness. Accepted for suggestions, never for saved learner data.

## Remaining limit and experiments not adopted

The cold supplier is still the lower bound for entirely new terms with no
matching known titles. In particular, **Bil** returned 251 provider candidates;
the first 100-node response alone took 5,510 ms in a direct probe and a native
action encountered the existing eight-second deadline. This is not presented
as a subsecond cold search. Known Bilanz/Handelsbilanz matches now remain usable
immediately on backspace and on a failed broad refresh, covered by a regression.

The generic endpoint rejected additional `cm:name` and `ccm:collectiontype`
criteria with HTTP 400, so unsupported filtering was not shipped. A 20-node
page was quicker (1,659 ms) but would need more requests or lose later context
matches under the established budget; it was not adopted. A wildcard catalog
probe did not yield a usable complete catalog export. No full local mirror,
aggressive multi-query prewarming, shortened result coverage, blanket timeout
increase, four/five-way speculative page fan-out or new search provider is hidden
in this change. These would require their own completeness, freshness or load
contract. The existing supplier errors continue to allow free entry and valid
selection/note continuation.

## Validation

- Complete final run: **139 Vitest files / 1,117 tests**, **18 additional Node
  tests**, **102 Jest suites / 544 UI tests**, all passed. `VITEST_MAX_WORKERS=2`;
  Vitest 84.59 s and Jest 53.951 s. No timeout, skip or lockfile changes. Local
  pnpm used the same command-only dependency verification override documented
  in the earlier QA report. Full lint and TypeScript passed afterward.
- CodeRabbit reviewed the final eleven tracked changed files, including the
  backspace/error-retention change and ADR, with **zero findings**. The Convex
  checklist covered authentication before shared-cache access, internal-only
  indexed reads/writes, argument/return validators, bounded storage and no
  learner-data access. Development deployment/code generation passed again.
- Provider/resolver/cache tests exercise the actual adapter and authenticated
  action: equivalent contexts, different context ranks, cached authentication,
  expiry, failed responses, hash-slot collision and storage shape, exact-page
  totals, two-request concurrency, result order and bounded broad searches.
- Rendered UI tests exercise real selection/notes, delay, normalized instant
  hits, in-flight reuse, narrow authoritative refresh, backspace after a failed
  broad request and stale response protection. Existing save/pause tests remain.
- Development Convex code generation, typecheck and deployment succeeded. No
  production deployment, production dataset access or OTA publication.
- Full-suite, review, native evidence and current-head CI outcomes are recorded
  in the PR. Earlier native acceptance media retain their original revision.
  The new emulator timing probes are local-only diagnostics, not analytics or
  release-build measurements; they are removed from the final source.

### Native recording scope

Dedicated Android 16/API 36 emulator `emulator-5574`, regular development app
and synthetic Clerk account, live development backend. The preview uses the
existing #884 + separate #891 startup-fix worktree, with this change's search
component and context helper copied in. Jakob's Pixel and its Metro were not
used or interrupted. This is a focused search regression, not a repeat of all
platform/accessibility acceptance.

`search-speed-reviewed.mp4` is the original 21.22 s screen recording, SHA-256
`a4825b511db8ebd3fa86d972c391867f6a14719f3c5dfbc5d6736f83017fff8d`.
Inspected its entire timeline at 2 fps: 42 frames across three contact sheets;
no audio. At 0–0.5 s, `Bil` is entered and loading is visible; at 1–5.5 s,
known Bilanz/Handelsbilanz matches coexist with refresh status. At 6 s the query
becomes `Bilanz`; matches are visible by the 6.5 s sample without refresh status.
At 15–20.5 s, Bilanz is checked and the selected-topic heading appears. The
keyboard obscures the note in those latter frames; the recording does not by
itself establish the note's final value. Sampling and the development emulator
do not establish subsecond production rendering or a precise keystroke latency.

The video and first three screenshots include local console-only timing probes;
none is in the product source. After removing the probes, the preview search
component matched this PR byte-for-byte (SHA-256
`5da78ee6deea1532fcc169c458c7afcc6f5aac69476a5f642d5c9653d78f65a5`).
`search-clean-final.png` shows the persistent Bilanz chip, full independent
synthetic note and enabled Weiter in that clean component. A fresh hierarchy
assertion verified the note remained exactly `Test ist ohne Hilfsmittel. Auch
Inventur und Belege.`. Raw captures are attached in the PR rather than committed.

PR #884 remains the preferred version for Julius' DAY-517 validation. Record
cold and warm searches separately; time until the complete verified exam scope
is entered still matters more than time to the first visible suggestion.
