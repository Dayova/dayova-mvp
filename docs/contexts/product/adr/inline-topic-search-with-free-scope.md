# Direct topic selection with separate additional information

Accepted by Jakob on 17 October 2026 as a correction to the first implementation of “Suche direkt”. Student benefit remains unvalidated. The earlier append-to-editor model is superseded.

The rationale and validation plan live in the [Notion decision record](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a), under Product, and [DAY-517](https://linear.app/dayova/issue/DAY-517). PR #884 remains the preferred template for Julius’ validation. Fabius’ #872 remains independent.

## Input and interaction contract

- Search directly in the topic step. Results are reversible checkbox selections, using shared SelectionControl semantics and styling.
- Immediately below the input, the entered nonblank title is selectable without waiting for a catalog result. It uses ordinary `topicItems` and the same reversible choice/chip behavior, including provider errors and input beyond the catalog search limit. Never silently truncate it or add global/provider records. An exact normalized catalog match occupies this same row; a late response must not duplicate or rewrite a chosen title. Show up to five other catalog alternatives. The existing meaningful-scope validation still applies.
- Show every selected title as a removable chip even when the query changes, clears, fails, or yields no results. Removing a chip unchecks its matching result. Match normalized complete titles, never substrings or inferred meanings.
- The separate optional “Hinweise zur Prüfung (optional)” textarea is presented for conditions and special instructions (OHiMi, ohne Taschenrechner, Lösungsweg angeben). Missing catalog topics can be selected from the entered-title row without retyping below. Legacy lists, subskills and arbitrary additional text remain editable; selecting or removing a result never writes into, removes from, or interprets that field.
- Search remains optional. A meaningful catalog/own selection, free entry, or combination can continue; an empty scope and known placeholders cannot. Conditions alone are not evidence that the true exam scope is complete; Julius must evaluate completeness against school requirements.
- Catalog search accepts three to 100 characters and debounces new requests by 120 ms. Exact local cache hits and already running requests skip that delay. Known matching titles may appear immediately while an authoritative search refreshes in the background, including after backspacing; this preview never suppresses the new request or invents an empty result. The same title/context ranking applies to both paths. Keep at most five other catalog alternatives in addition to the entered-title row, and 30 local cache entries, each valid for five minutes. Search failures never block editing or a valid scope; known matches remain selectable when refreshing fails. Saving and snapshot loading disable search, selection/removal and editing.
- No second subject picker. Personal subjects retain their IDs, ownership, reuse and management. Derive search context internally from the current subject name; exact title matches remain available across subjects. No provider IDs or categories become subject identity.

## Persistence and compatibility

- Optional learningPlans fields `topicItems` (chosen titles) and `topicAdditionalInfo` (verbatim additional text) preserve the UI separation and title boundaries through pause, back and reopen. Never split titles at commas or semicolons.
- `topicDescription` is the validated compatibility projection of both fields, joined with newlines. AI, material analysis and the related calendar entry keep receiving the full scope including conditions. All three are updated in one mutation; reject divergent projections.
- Old records without structured fields are read as an empty selection plus the intact legacy text and distinct legacy teacher guidance in the free field. Do not invent catalog selections from historical prose. No backfill is needed; fields are optional.
- Legacy writers changing the projected scope clear stale selection metadata. Unchanged legacy writes preserve it. Existing owner/status checks and invalidation of derived learning evidence remain active.
- Saved snapshots take precedence over stale route parameters. Unsaved back routes round-trip JSON title boundaries and additional text. Search query and provider IDs are never persisted as scope.
- No new analytics payload containing any free text, topics or notes.

## Provider boundary

The authenticated WLO adapter originated in #872 at `c9a4c4e41aafe71cc8f97004ad16ba01ba504226`. The performance follow-up uses the supported metadata search endpoint with the same `collections` query, requests only taxonomy properties, and disables unneeded collection/user resolution and spelling suggestions. Keep the five-page / 100-node page budget, 20 returned titles and eight-second deadline. Trust a valid total to avoid empty extra pages and fetch subsequent pages in batches of at most two; merge in page order. Missing totals retain the sequential fallback. Send only the search term upstream, never account identity, full exam scope, conditions or school materials. Catalog coverage and typo tolerance remain validation questions.

A best-effort server cache stores public suggestions for five minutes in at most 256 hash-addressed slots. Its digest contains a version, normalized query and resolved context; no raw query, personal subject name or user identity is stored. Check authentication before reading, compare the complete digest to reject slot collisions, and check expiry in the action rather than a time-dependent query. Cache failures fall back to the provider, and provider failures are not cached. These are per-layer TTLs; without a freshness timestamp propagated to the client, a server hit subsequently cached locally may be nearly ten minutes old. This bounded catalog staleness is accepted; it does not apply to a learner's saved selections or notes.

Measurements, tradeoffs and the remaining cold-provider limit are in the [performance verification](../../../qa/topic-search-performance-2026-10-17.md). No whole-catalog synchronization or change to personal subject identity is introduced.

## Acceptance limits

Earlier append-to-text galleries document earlier revisions, not this interaction. Capture current native selection and notes separately and record the exact revision. iOS, VoiceOver, TalkBack, large text and persistence claims require their own checks; changing the model does not inherit an earlier acceptance.
