# Inline exam-topic search — validation, 16 October 2026

## Source and scope

- Integration base: `3eb4e5d29f8cb2771fb79825c3b447587c514740` (`origin/main`).
- Branch: `codex/inline-exam-topic-search`, [PR #884](https://github.com/Dayova/dayova-mvp/pull/884), independent of Fabius' PR #872.
- Provider adapter and shared search-field starting point: PR #872 revision
  `c9a4c4e41aafe71cc8f97004ad16ba01ba504226`, adapted to an authoritative free editor.
- Selected direction and reasoning: [Notion decision-record draft](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a).
- Student validation: [DAY-517](https://linear.app/dayova/issue/DAY-517).

## Passed checks

- Vitest: **140 files, 1,079 tests passed**, with `--maxWorkers=2`.
- Focused native UI suites: **3 files, 44 tests passed** (inline search, setup
  steps and route-level creation flow).
- TypeScript, changed-code Biome/ESLint and `git diff --check` passed.
- Convex code generation and deployment to the configured **development**
  deployment `kindred-canary-599` passed. No production deployment was performed.
- A live `wloTopics:search` call for `Gedicht` / `Deutsch` returned
  `Gedichtanalyse` through the deployed action. The CLI supplied a synthetic
  identity; this verifies the authenticated action path, not Clerk sign-in or
  a real student session. No student text or production account was used.

The UI tests cover long pasted scopes without searching, latest-text append,
removing/re-adding a suggestion, debounce, stale responses, subject-specific
cache behavior, retry/no-results fallback, oversized search terms, bounded
results, busy input states and preserving the full scope through save/back.

The first unrestricted Vitest run hit seven failures in unrelated CRM/config
tests under parallel load. All affected tests passed serially, and the entire
140-file suite then passed with two workers. This is not an unresolved failure
being excluded from the final result.

## Native evidence follow-up

The follow-up requested by Jakob adds native before/after screenshots, a
scenario gallery and four device recordings as GitHub attachments on
[PR #884](https://github.com/Dayova/dayova-mvp/pull/884). See the
[state matrix and reproduction](../evidence/pr884/README.md) and
[full-timeline video observations](../evidence/pr884/video-observations.md).
The product implementation is unchanged from `d126c3d4`.

Follow-up validation: TypeScript, Biome on all five evidence scripts, Node
syntax checks, and a prepare/restore smoke check passed. `index.ts` is restored
exactly and the generated baseline is absent. The published gallery contains
45 verified attachment URLs (40 original screenshots, one comparison and four
recordings), with no local-path or uploading placeholders. A fresh CodeRabbit
CLI attempt was rate/seat limited again; the staged evidence diff was manually
reviewed for source provenance, anonymous content, truthful coverage, attachment
mapping and isolation from the production entry.

The captures use real PR components in an isolated Android entry. Controlled
provider responses cover failure/latency states; live WLO scenes use the actual
adapter through a loopback server. Material/back is local fixture state, not a
database write. No production accounts or credentials appear in the media.

**Native acceptance remains open:** scene switches/development refreshes can
leave static text visually missing despite its presence in the native
accessibility hierarchy. The raw evidence retains this finding. A full-route
check with a matching native/release build is needed to determine whether it
also occurs outside the fixture. Custom-subject catalog coverage remains
limited, and vague/page-reference inputs are accepted without clarification.

## Remaining evidence and limitations

- The optional full UI-suite run was interrupted after prolonged runtime
  (including an existing preparation-slot-editor suite taking 267.765 seconds).
  It produced no final suite verdict and is not counted as green. The focused
  suite above was independently rerun on the final component changes and passed.
- The initial Android attempt failed before evidence capture. It is superseded
  by the component captures above, including keyboard, light/dark, system text
  scale and a smaller viewport. These do not establish full native acceptance.
- iOS, TalkBack/VoiceOver, Clerk sign-in, personal-subject creation and an actual
  persisted save/reopen journey are not covered by the new media. The reused
  development binary is not a fresh native build of this lockfile.
- CodeRabbit CLI **0.7.5** (valid CodeRabbit signature) was authenticated, but the
  review was rejected by its account review-capacity/seat limit. This is not a
  completed CodeRabbit review. The diff was manually inspected for scope,
  preservation of learner input, stale-request handling, authentication,
  provider limits, icon provenance and recovery behavior.
- WLO's collection-search endpoint is deprecated. Typo coverage and catalog
  completeness are not proven by the successful single live query.
- The feature is an implementation for Julius' preferred validation template;
  neither benefit to students nor release readiness is established by tests.

Keep the PR in draft pending the remaining native evidence and human review.
