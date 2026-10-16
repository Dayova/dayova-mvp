# Direct topic selection with separate additional information

Accepted by Jakob on 17 October 2026 as a correction to the first implementation of “Suche direkt”. Student benefit remains unvalidated. The earlier append-to-editor model is superseded.

The rationale and validation plan live in the [Notion decision record](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a), under Product, and [DAY-517](https://linear.app/dayova/issue/DAY-517). PR #884 remains the preferred template for Julius’ validation. Fabius’ #872 remains independent.

## Input and interaction contract

- Search directly in the topic step. Results are reversible checkbox selections, using shared SelectionControl semantics and styling.
- Show every selected title as a removable chip even when the query changes, clears, fails, or yields no results. Removing a chip unchecks its matching result. Match normalized complete titles, never substrings or inferred meanings.
- The separate optional “Zusätzliche Themen und Hinweise” textarea accepts conditions, subskills, missing catalog topics and complete pasted lists. Selecting or removing a result never writes into, removes from, or interprets that field.
- Search remains optional. A meaningful selection, free entry, or combination can continue; an empty scope and known placeholders cannot. Conditions alone are not evidence that the true exam scope is complete; Julius must evaluate completeness against school requirements.
- Preserve existing query budgets: three to 100 characters, 350 ms debounce, bounded cache and at most five displayed results. Search failures never block editing or a valid scope. Saving and snapshot loading disable search, selection/removal and editing.
- No second subject picker. Personal subjects retain their IDs, ownership, reuse and management. Derive search context internally from the current subject name; exact title matches remain available across subjects. No provider IDs or categories become subject identity.

## Persistence and compatibility

- Optional learningPlans fields `topicItems` (chosen titles) and `topicAdditionalInfo` (verbatim additional text) preserve the UI separation and title boundaries through pause, back and reopen. Never split titles at commas or semicolons.
- `topicDescription` is the validated compatibility projection of both fields, joined with newlines. AI, material analysis and the related calendar entry keep receiving the full scope including conditions. All three are updated in one mutation; reject divergent projections.
- Old records without structured fields are read as an empty selection plus the intact legacy text and distinct legacy teacher guidance in the free field. Do not invent catalog selections from historical prose. No backfill is needed; fields are optional.
- Legacy writers changing the projected scope clear stale selection metadata. Unchanged legacy writes preserve it. Existing owner/status checks and invalidation of derived learning evidence remain active.
- Saved snapshots take precedence over stale route parameters. Unsaved back routes round-trip JSON title boundaries and additional text. Search query and provider IDs are never persisted as scope.
- No new analytics payload containing any free text, topics or notes.

## Provider boundary

The authenticated WLO adapter originated in #872 at `c9a4c4e41aafe71cc8f97004ad16ba01ba504226`. Keep its subject-context ranking and existing request/page/cache budgets. Send only the search term upstream, never account identity, full exam scope, conditions or school materials. Catalog coverage and typo tolerance remain validation questions.

## Acceptance limits

Earlier append-to-text galleries document earlier revisions, not this interaction. Capture current native selection and notes separately and record the exact revision. iOS, VoiceOver, TalkBack, large text and persistence claims require their own checks; changing the model does not inherit an earlier acceptance.
