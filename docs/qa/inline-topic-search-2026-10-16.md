# Inline exam-topic search — validation, 16 October 2026

## Source and scope

- Integration base: `3eb4e5d29f8cb2771fb79825c3b447587c514740` (`origin/main`).
- Branch: `codex/inline-exam-topic-search`, independent of Fabius' PR #872.
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

## Remaining evidence and limitations

- A full UI-suite run was started separately; its final result must be recorded
  before treating it as green. The focused suite above is independently green.
- Native visual acceptance is **not complete**. A separate read-only Android 16
  emulator and development client were started, but the client became
  unresponsive before the component preview was verified. Automatic execution
  review rejected a subsequent combined app-control/bundle command with only
  `blocked by policy` as its stated reason. The block was not bypassed. The
  temporary fixture and entry changes were removed; the dedicated emulator and
  Metro were stopped.
- No new before/after native screenshots or recordings are claimed. Android
  keyboard, font scaling, light/dark appearance and TalkBack remain unverified
  for this implementation. iOS and VoiceOver were not available on this host.
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
