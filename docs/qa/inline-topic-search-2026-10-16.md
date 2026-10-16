## Interaction correction — 17 October 2026

Product revision: `a844f7a1aa69fb302725460457873b2924c1b7ea` (PR #884). Pixel preview: `7b7d615d`, combining that change with the separate startup fix from #891. The preview adds no subject changes.

The append-to-text model below is historical. Current behavior: reversible topic checkboxes, removable visible selections across queries, and an independent optional additional-information editor. Selecting or removing topics never modifies that editor. `topicItems` and `topicAdditionalInfo` are stored separately, and their validated projection feeds existing plan/AI/calendar consumers. Legacy lists remain intact as free text. See the updated [input contract](../contexts/product/adr/inline-topic-search-with-free-scope.md).

Validation:

- Full Vitest run: **139 files / 1,111 tests passed**, two workers, 110.84s.
- Focused UI: **63 tests passed** in topic search, setup and creation flow. Includes reversible selection, selection-only continuation, persistent chips across queries, unchanged notes, saved metadata beating stale routes, and JSON boundaries through unsaved back navigation.
- Backend: real mutations and snapshots round-trip selection/notes and synchronize the calendar projection. Mismatched projections fail before writing; legacy edits clear stale selection metadata.
- Final route parser guard: **9 focused tests passed** after rejecting empty and duplicate route titles. Existing scope strings remain the fallback for invalid metadata.
- TypeScript, targeted Biome and applicable ESLint passed. ESLint reports only ignored generated/evidence files, not source failures.
- CodeRabbit reviewed all 20 changed files after staging the new module. Two evidence-harness findings were confirmed and fixed (reset selection between scenarios; allow selection-only Continue). A route-parser finding was confirmed and fixed. Final residual comments were checked manually: the 17 October date matches this task's client date and explicit correction; empty draft creation is intentional, while start/updateRequiredTopics/updateBasics already assert meaningful scope before saving a completed topics step. Neither requires a code change.
- Development Convex deployment `kindred-canary-599` succeeded. No production deployment or backfill. Optional schema fields keep old records valid.

Native evidence remains revision-specific. The earlier Pixel smoke check proved the prior interaction could open and search; it does not prove this correction. Current iOS, VoiceOver, TalkBack, large text and complete new-model save/reopen acceptance are not established by the automated tests. PR remains Draft. Current Pixel smoke test passed after unlocking: regular app creation flow to topics, real search, selection, chip removal with unchanged additional information, and persistent selected chip after clearing the query. [Three raw Pixel captures: before/after and removal](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6226000485). Product revision a844f7a1, preview 7b7d615d (separate analytics fix included). This is not on-device persistence or broad accessibility acceptance.

---

# Inline exam-topic search — validation, 16 October 2026

## Selective follow-up from PR #872

Compared against #872 head `146098d2f06178772c67cb487c8efceda1019a4d`,
after the earlier adapter baseline `c9a4c4e`. The branch now integrates
`main` at `8b9b8af5` via merge `e6484c70`; it remains independent of #872.

| Improvement | Treatment in #884 |
| --- | --- |
| Save edits before pausing; recover from failed saves without leaving | Retained through current `main`, including the close control, action gate, retry and invalid-edit protection. A rendered accounting-search regression also checks that appending Bilanz preserves the full existing scope when pausing. |
| Saved draft versus old route text | Adapted from #872: resumed plans initialize from their snapshot rather than stale `topicDescription` or `teacherGuidance` route values. Tests check the displayed text and Continue mutation payload. |
| Draft still loading | Adapted from #872: search, topic editor and Continue stay disabled until the snapshot is available, then restore the actual saved text and become usable. |
| Oversized search input | Adapted from #872: authenticated requests over the bounds return an empty result without contacting WLO, rather than a misleading provider failure. Includes normalization expansion and the inclusive 100-character boundary. The existing UI retains its explicit long-query hint. |
| Persisted `topicItems` and chip-boundary edits | Not adopted. #884 retains one authoritative editable string; no chip reconstruction or second persistence format is needed. Schema, personal-subject identity and the context resolver are unchanged. |
| Accessible search error and shared SearchField | Already present in #884; no duplicate implementation needed. |
| Native captures from #872 | Remain evidence of their named #872 revisions. They do not establish native acceptance for #884 or its newly integrated header. |

Validation after adoption:

- **All 139 Vitest files / 1,103 tests passed**, two workers, 105.28 seconds.
- **62 rendered UI tests / five suites passed**, including creation flow,
  topic search, setup steps, creation shell and Android inline calendar.
- Focused provider/resolver/learning-plan backend run: **76 tests passed**.
  Three new UI regressions and three oversized-input cases failed before their
  fixes. No cases were removed or excluded.
- TypeScript, Convex code generation/typecheck, targeted Biome and source ESLint
  passed. ESLint does not cover the isolated evidence fixture; its integration
  was checked by TypeScript and Biome. Its new required close callback explicitly
  identifies the isolated test environment instead of pretending to save.
- CodeRabbit CLI 0.7.5 reviewed the four changed implementation/test files with
  **zero findings**; final test-label correction and merge integration were also
  inspected manually. No runtime deployment or new native recording is claimed.

The canonical decision record and DAY-517 include these reliability checks.
The native acceptance limitations below still apply. Earlier media retain their
exact revision and environment scope; none are relabelled as current-head proof.

## Native acceptance and timeout follow-up

Test-tooling revision: `4b2866327f5fdab972354db03a52ee1c690c9acc`.
Product components remain at the subject-context implementation below.

The timeout was reproduced with the complete two-worker suite (1,098/1,099
passing) and then with just
`pnpm exec vitest run tests/ota-safety.test.ts -t 'honors the explicit Watchman opt-in' --maxWorkers=1`.
The latter took 12.33 seconds against its five-second limit. A timing probe
measured 7.49 seconds inside the real Metro `require`, with normal process exit
shortly after; a stuck child process was not observed.

Configuration integration checks now use asynchronous child processes bounded
to 25 seconds, with a 30-second test budget. The five iOS assertions are kept
in one suite: each real development/production Expo introspection runs once in
bounded setup, directly through the installed Expo CLI instead of `npx`.
The two variants have separate processes and rebuilt Jiti caches. No global
test timeout, product behavior, test exclusion or mocked configuration was added.

- Complete Vitest run: **139 files / all 1,099 tests passed**, two workers,
  145.21 seconds. Three iOS files became one; no test cases were removed.
- Final TypeScript and whitespace checks passed. After a small readability-only
  change, both changed suites passed again: **34 tests**, 8.04 seconds.
- An intermediate full run during native compilation had two different
  five-second timeouts in unchanged OTA-report/diagnostic tests. The all-green
  run above was performed after compilation finished; those tests were neither
  changed nor excluded.
- A fresh **arm64-v8a** Android development client was built from this checkout's
  lockfile and regular product entry, then installed successfully on Jakob's
  Pixel 9. App/package version: 1.0.5 / `com.dayova.dev`. APK SHA-256:
  `5ed5f6910cd5db667bc71280c9714a55a11f21d968f139e86cb1b4065fc7239c`.
  This is a development client loading PR code from Metro, not a self-contained
  release APK. The separate production app was not replaced.
- The initial standalone release attempt stopped at the existing release-env
  guard because local development lacked store/legal configuration. A proposed
  development-only iOS build profile also failed config evaluation and was
  removed; existing build profiles and release guards are unchanged.
- Automated opening of the installed app by deep link was rejected by the
  automatic approval review (no detailed reason returned). Jakob received a
  private QR code to open it himself. No rejection was bypassed; installation
  success alone is not counted as an authenticated native journey.

### Native acceptance disposition

Jakob opened the private QR code himself. A read-only screenshot of his Pixel
then showed the complete regular registration/login screen with visible text;
Metro reported the regular 8,146-module Android bundle and Clerk development
keys. The phone screenshot stays private. This establishes installation and
startup, not sign-in, subject creation or saved data.

| Check | Result / remaining work |
| --- | --- |
| Complete unit/integration suite and current-head CI | Passed. All 1,099 tests locally; GitHub/EAS lint, typecheck, tests, native fingerprints, OTA gates and report freshness green at revision `5a6c9834f3e8b527c565fe05b042008d0fe69927`. |
| Pixel 9, fresh ARM64 development client, regular app entry | Installed and registration/login screen visibly loaded. Metro must remain available while Jakob tests. |
| Matching iOS native build | Built successfully with the existing `development-simulator` profile: [EAS build d4d9232e](https://expo.dev/accounts/dayova/projects/dayova/builds/d4d9232e-e4e7-4410-9c4c-1a2c00382809), source `5a6c9834f3e8b527c565fe05b042008d0fe69927`, Expo 57 / React Native 0.86.3. Build success is not simulator acceptance. |
| iOS simulator journey | Blocked before a simulator session was created: the authenticated EAS CLI reports “EAS Simulator isn't available on dayova yet — it's coming soon.” No iOS screenshot or runtime pass is claimed. The ready build can be installed on an available iOS simulator. |
| Signed-in Android journey, create Rechnungswesen, search/append Bilanz, save/back/reopen | Open. A fresh x86_64 client built successfully and installed on the dedicated read-only emulator, but project loading did not reach the app UI. An initial native error was `Unable to load script`; the later native log records `DebugServerException`, HTTP 504 / `Gateway Timeout` while downloading the development bundle. Network reachability and Metro status were checked. This is a development-bundle delivery failure, not proof of a topic-search defect or pass. |
| Keyboard, current large font, small viewport, dark appearance, TalkBack | Open on the full route. Installed TalkBack and configured screen dimensions are prerequisites, not acceptance evidence. Older component captures keep their original scope. |
| Physical iPhone / VoiceOver | Explicitly deferred by Jakob: “Zunächst nur die übrigen Prüfungen abschließen.” Still open; this does not waive the other checks. |

The x86_64 debug APK SHA-256 is
`ababa4950be6f1fffea3a6621fc3d7b6df76d043826e6372b51896957f4ad61d`.
It is distinct from the ARM64 APK installed on the Pixel. Both builds use the
regular product entry, not the isolated evidence fixture. No synthetic account
credentials, session tokens, personal-phone screenshots or media binaries are
committed.

Automatic approval review rejected restarting the owned test emulator with more
memory and a subsequent attempt to connect it to a separate local test server;
only “blocked by policy” was returned. Neither rejected action was executed or
bypassed. The iOS service restriction and Android startup problem prevent a
complete native acceptance in this environment. Keep Draft until the remaining
full-route evidence is recorded. Earlier galleries retain their stated fixture
and native-binary limitations; the successful builds do not retroactively
upgrade their provenance or resolve earlier rendering findings.

## Subject-context follow-up

Product commit: `bf90d6390da34659ba61b6057d1319d7f93a0310`.
The central name-to-context resolver recognizes explicit aliases/course markers
and combinations of known areas. Context ranks editorial title matches instead
of excluding other subjects. Exact titles survive a wrong historical subject;
unknown personal names search without invented context. Personal-subject schema,
IDs, ownership, creation, rename/delete and reuse are unchanged. The UI shows
bounded provider labels and additional suggestions, without a new subject picker.

Checks on this change:

- 28 focused backend/resolver tests passed; three focused UI suites / 46 tests
  passed. Coverage includes aliases, combined/unknown names, accounting under
  both subjects, ambiguous terms, name/cache changes and title-only append.
- The broad two-worker run had 137/141 files and 1,094/1,099 tests passing; five
  existing Expo config checks hit wall-clock limits. Serial reruns passed those
  cases. A second complete one-worker run had 140/141 files and 1,098/1,099 tests
  passing, with only the unchanged iOS privacy config timing out at 15 seconds.
  After stopping the dedicated test services, that exact test passed in 8.53
  seconds. No test thresholds, exclusions or unrelated config files were edited.
  **A single all-green full-suite run is not claimed.**
- Final TypeScript, Biome on all ten changed source/evidence files, changed-code
  ESLint, Node syntax checks and whitespace checks passed. Production `index.ts`
  is restored and the generated evidence baseline is absent.
- Convex code generation and deployment to **development** kindred-canary-599
  passed. Six real action calls with synthetic CLI identity passed; see
  [the response report](../evidence/pr884/live-context.json). Bilanz is found for
  Rechnungswesen, Mathematik, a combined subject and an unknown name; Mathe LK
  returns mathematics topics. This does not prove Clerk sign-in.
- CodeRabbit CLI 0.7.5 has a valid CodeRabbit signature and completed the final
  staged/uncommitted review of all twelve changed files with **zero findings**.
  An earlier review correctly flagged the temporary fixture entry; it was restored
  before this clean review and is not part of either commit.
- Eight current Android screenshots and a complete-timeline inspected 115.93s
  recording are in the [new gallery](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6222821260).
  Earlier captures remain clearly labelled with their historical product source.

Current limitations: the reused development APK is not a fresh native build;
large-font rechecking lost fixture state and hung in device control. iOS,
screen readers, actual subject creation and persisted save/reopen remain open.
Earlier native rendering findings are not declared fixed. Keep the PR in Draft.

The decision record under Product, DAY-517, DAY-465, DAY-491 and the single
[open hypothesis](https://app.notion.com/p/3fb2e87228bf81018a0fe1b14eb9b409)
are reconciled with this scope. This version remains Julius' preferred validation
template; no student validation or production release is inferred from these checks.

## Initial implementation and first evidence round

## Source and scope

- Integration base: `3eb4e5d29f8cb2771fb79825c3b447587c514740` (`origin/main`).
- Branch: `codex/inline-exam-topic-search`, [PR #884](https://github.com/Dayova/dayova-mvp/pull/884), independent of Fabius' PR #872.
- Provider adapter and shared search-field starting point: PR #872 revision
  `c9a4c4e41aafe71cc8f97004ad16ba01ba504226`, adapted to an authoritative free editor.
- Selected direction and reasoning: [Notion decision record under Product](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a).
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
