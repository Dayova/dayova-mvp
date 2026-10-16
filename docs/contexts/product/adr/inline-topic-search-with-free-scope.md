# Direct topic search with an editable exam scope

Accepted for implementation by Jakob on 16 October 2026 after selecting
`Suche direkt` in the interactive comparison. Student benefit remains unvalidated.

The full rationale, evidence, alternatives and validation decision are in the
[Notion decision record](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a)
(currently a private draft). [DAY-517](https://linear.app/dayova/issue/DAY-517)
owns the student validation; this implementation is its preferred test template.

## Code-facing contract

- Place optional subject-specific search directly above the free-text editor.
  Do not replace the editor with chips or add a mandatory search step.
- `topicDescription` remains the authoritative string. Preserve existing text,
  line breaks, subskills and conditions when appending an explicitly selected
  suggestion. Do not persist the search query or provider IDs as exam scope.
- Recognize complete matching entries (including simple bullets and comma or
  semicolon lists) to avoid duplicate additions. Never infer semantic equality
  or replace detailed requirements with a broad catalog label.
- Determine inclusion from the current editor value so removing an entry makes
  that suggestion available again. The provider response must never capture
  and restore an earlier editor value.
- The editor has no new character cap. Search terms longer than 100 characters
  remain visible, trigger no request and point to the free editor; do not
  silently truncate pasted input.
- Search begins after three characters and a 350 ms debounce. Cache at most
  30 subject/query results for five minutes, ignore stale completions and show
  at most five inline results with a refinement hint when necessary.
- Search loading, no matches and recoverable provider failures do not block
  editing or continuing with a valid scope. Saving disables both inputs.
- A single meaningful topic can pass validation; known placeholders cannot.
- Keep the existing exam/draft persistence, back-navigation and school-material
  requirement. No schema migration or additional analytics free-text payload.

## Provider boundary

The authenticated Convex action adapts the WLO collection-search integration
originating in Fabius' PR #872 (source revision
`c9a4c4e41aafe71cc8f97004ad16ba01ba504226`). The separate PR intentionally
reuses that provider work while implementing the selected free-editor layout.

Only the entered search term and selected subject are supplied to the action;
the upstream request sends the search term. No account identity, full scope,
school material or conditions are automatically sent to WLO. Search is bounded
to five pages of 100 collections, 20 returned suggestions and an eight-second
request budget. Editorial titles and subject aliases are validated and filtered
server-side. The deprecated provider endpoint is isolated for replacement;
the editor remains usable if it stops working. Typo tolerance and catalog
coverage must be observed rather than assumed.

This direction supersedes the earlier suggested sheet placement for this work.
It does not merge, close or change Fabius' PR, establish a production rollout,
or pre-empt Julius' recommendation after testing.
