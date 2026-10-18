# Live topic suggestions and shared selection cards

PR #884 / [DAY-530](https://linear.app/dayova/issue/DAY-530). Incremental baseline: `ffa387437b91d953426322bfe14f00f944fceae9`. This follow-up addresses the reported empty “Gedichts” search and the explicit request to match exam-type/subject selection. [Product decision](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a) and [evidence checklist](https://app.notion.com/p/3dc2e87228bf81c69e43cadf318c2d9f).

## Reproduction and cause

The previously open simulator was still running the temporary Rhetor-only sample preview. That preview returned no results for other queries. Separately, the real WLO provider returned “Gedichte” for “Gedichts”, but both provider filtering and shared ranking rejected it using literal substring matching. The unchanged baseline returned an empty list for “Gedichts” and two results for “Gedicht”.

A regression at `searchWloTopics` replaying the observed provider response failed with expected `[Gedichtanalyse, Gedichte]`, received `[]`, before the fix. The same regression now passes. Both matching paths share bounded one-edit title-prefix tolerance, with one optional shorter-prefix lookup when no literal title survives. Subject ranking, title ownership, private/demo exclusion and explicit selection remain intact. Cache namespace v3 prevents old cached empty answers from surviving the update. No schema migration or new service.

## Design brief and review

- Job: find and deliberately select several exam topics or optional hints.
- Hierarchy: question/search, relevant selectable cards with subject labels, removable selections; Weiter remains the primary action.
- Friction: exact typing previously hid useful titles; five visible rows hid additional already-returned results; custom plus rows diverged from the creation flow.
- Decision: reuse `SelectionOptionRow` with checkbox semantics for topic/hint choices, preserving radio semantics for exam/subject choices. Its existing rounded surface, selected border/accent, typography, feedback and indicator define the appearance. “Mehr Vorschläge anzeigen” reveals all returned alternatives up to the server cap. Pages remain separate.
- Self-review covered the incremental diff, requirements, both matching paths, subject/context ordering, bounded requests/deadline, fallback failures, cache versioning, disabled choices and multiple selection. No outstanding change-specific findings. Weakest prior visual decision—the custom selection-row treatment—was replaced by the existing shared component.

## Validation

Node 24.22.0; unchanged installed dependencies reused from the main workspace.

- Vitest: 141 files / 1,139 tests passed.
- Jest: 101 suites passed in the full run; two new-test assertions used an unavailable matcher and were corrected. Both affected suites then passed (23 tests); aggregate 103 suites / 557 tests passing. No skipped acceptance tests or timeout increases.
- Node script tests: 18 passed.
- TypeScript, full Biome lint, ESLint, Tailwind ordering and changed-file Biome check passed.
- Repository-wide formatting reports two pre-existing files: `scripts/publish-production-ota.mjs` and `src/features/learning-plans/use-prepare-session-content.ui.test.tsx`. Formatting their untouched HEAD contents reproduces the same differences. No unrelated formatting changes included. A broader Biome check also reports pre-existing import ordering; the configured lint command passes.
- The pnpm script wrapper wanted to reinstall the shared dependency directory and declined without a TTY; the actual configured test/lint/typecheck commands were executed directly instead. No dependency replacement.
- Full app iOS and Android Hermes exports passed sequentially using development configuration, restored product entry, and two workers. Earlier combined export attempts stalled at bundler startup and were stopped; the successful platform exports each completed. This validates bundling, not a new native binary or runtime Android acceptance.
- Convex compiled with typechecking and deployed to an isolated anonymous local backend. The real `wloTopics:search` action, invoked with a synthetic local test identity, returned both expected “Gedichts” suggestions through live WLO and the cache path. This is not a deployment to Dayova's shared development or production backend and not a Clerk login test.
- `node scripts/evidence/pr884/live-search-regression.mjs` tests the real adapter against live WLO. Captured results: Gedichts 2 (Deutsch first), Gedicht 2, Gedichtsanalyse 1, Rhetor 1 (“Rhetorische Stilmittel”), Vektor 7, Zelle 8, unrelated xyzqzvxx 0. Observed adapter times 587–3350 ms; a sample, not an SLA. The provider controls catalog coverage; the fix does not invent extra topics.

## Native evidence and limits

[Published before/after screenshots and videos](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6243084613), uploaded with native GitHub CLI attachments under the existing Gamius00 identity. All four images loaded at full dimensions and both videos loaded with metadata and playable buffers in the GitHub comment. Asset URLs, sizes and SHA-256 checksums are recorded in `docs/evidence/pr884/live-search-assets-2026-10-18.json`. Product revision: `573dce62`; the later evidence-only commit does not change runtime code.

Actual iPhone 17 Pro simulator, iOS 26.5, real screen/header/scroll/selection components, local selection state. The temporary capture entry calls the real server-side adapter through a loopback bridge; every catalog response is live. No hardcoded suggestion fixture. The bridge bypasses the deployed authenticated action for the video; that action was separately tested on the isolated local backend as described above. Temporary entry restored and bridge source kept only under `/tmp`; no preview route added to the product.

Before: “Gedichts” enters at 4.0–4.5 s, empty-result message visible from 5.0 s through the end.
After: “Gedichts” enters at 4.0–4.5 s, two subject-labelled suggestions visible at 6.0 s, selected Deutsch card/chip at 15.5 s, hints page at 22.5 s, two hint chips at 26.0 s. The second topic selection was confirmed in the accessibility tree/back navigation; its brief transition is not resolved by the video samples. Light and dark topic/hint stills inspected. No claim of persistence beyond local screen state.

Coverage: 14.50-second video; 29 full-timeline frames sampled at 2 fps (0.5-second interval); 2 contact sheet(s); no audio stream.

Coverage: 26.61-second video; 53 full-timeline frames sampled at 2 fps (0.5-second interval); 4 contact sheet(s); no audio stream.

All six full-timeline contact sheets inspected. Sampling establishes the states above, not sub-frame timing or animation smoothness. Software keyboard, large text, VoiceOver, physical iPhone, full signed-in save/reopen and current Android runtime remain unverified. No Android device was connected. Shared accessibility labels, roles, checked/disabled states, wrapping and selection behavior are covered by automated tests; full assistive-technology acceptance remains open. PR remains draft. Existing TestFlight 1.0.7 (78) remains on a58b0d79.

## Follow-up: uniform topic suggestion rows

Removed the provider heading from successful topic results. The custom topic now uses its entered title with the subtitle “Eigenes Thema” in the same shared selection row as catalog suggestions. All topic choices share one 8-point gap container; text can still wrap for long titles and accessibility sizes. Subject labels and ranking remain unchanged. Existing topic/search-flow suite: 20 tests passed; TypeScript and changed-file Biome/ESLint checks passed. Reviewed selection identity, exact-match deduplication, pending/error custom choices and spacing.

## Follow-up: horizontal selection chips

Topic and hint selections now share a single horizontal ScrollView. Appending a choice reveals the end after native content layout, using animated scrolling unless reduced motion is enabled. Removing choices and content resizing do not deliberately reset the scroll position. Chip text can wrap within the measured viewport width; full labels and remove actions remain accessible. Existing saved data is unchanged. Reviewed row mounting, append/removal behavior, long labels, reduced motion and the two callers.

Thirty existing UI tests across topic search, hint validation and setup steps passed. TypeScript, changed-file Biome and ESLint passed. No backend changes.

Native check: normal signed-in iPhone 17 Pro app with development backend. The existing Lineare Abhängigkeit selection was saved and restored before reload. At 9.8–10.0 seconds, adding Lineare Funktionen visibly shifts the chip row horizontally; at 15 seconds, a third selection is visible at the end without creating a second row. At 21 seconds a gesture attempt removed the middle chip; subsequent automated drag/scroll attempts did not establish manual swipe acceptance. This limitation remains explicit rather than claiming a successful gesture check. The capture contains simulator black-edge artifacts; frames were not altered. Additional selections used for inspection remain unsaved in the open editor.

Coverage: 53.47-second video; 53 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); 20 additional frames from 00:00:09.000 to 00:00:11.000 at 10 fps; no audio stream.

All four full-timeline sheets and both focused sheets inspected. The 9–11-second interval was additionally sampled at 10 fps to resolve the slide. No audio. This confirms the observed transition, not physical-device smoothness, Android, assistive-technology or native reduced-motion acceptance.

## Follow-up: four relevant suggestions

The topic list now shows at most four catalog suggestions in the existing relevance order, counting an exact match toward the limit. Additional cross-subject matches and the expansion action are hidden. Fewer relevant matches produce fewer suggestions; a custom entered title remains available separately when it is not an exact match. The same display rules apply to cached previews and final responses. Empty-result guidance waits for a completed successful response.

Validation: 31 tests across topic search and setup steps passed, including the four-result limit, exact-match counting, unrelated-only results, multiple selection and cached backspace recovery. One existing backspace fixture lacked subject metadata and was corrected to describe relevant Wirtschaftskunde titles. TypeScript, changed-file Biome/ESLint and whitespace checks passed. Reviewed the scoped diff for exact-match deduplication, provider ordering, filtered empty states, cached previews, custom input availability and selection preservation. No backend change.

Normal signed-in iPhone 17 Pro simulator app: saved and reopened the existing Mathematics draft, restored query “Qua”, and verified four Mathematics results (Quadratische Funktionen, Quadratische Gleichungen, Nullstellenberechnung bei quadratischen Funktionen, Würfel und Quader), followed by the custom “Qua” entry. The unrelated “Qualität entwickeln” result and both additional-results controls are absent. Existing Lineare Abhängigkeit remains selected. Screenshot inspected at full frame; this static follow-up does not establish additional animation or device coverage.
