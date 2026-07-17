# Issue tracker: Linear

Issues, specs, and tickets for this repo live in Linear.

- Workspace: `<workspace>`
- Team: `<team name>`
- Team key: `<KEY>`
- Backlog status: `<exact name>`
- Unstarted status: `<exact name>`
- Started status: `<exact name>`
- Review status: `<exact name>`
- Completed status: `<exact name>`
- Canceled status: `<exact name>`
- External PRs as a request surface: `no`
- GitHub Issues compatibility sync: `<none or owner/repo and sync direction>`

Use a semantic Linear connector such as the Linear plugin or hosted MCP. If both expose overlapping tools, choose one surface for a workflow; never repeat a mutation through both.

## Operations

- Create issues in the configured team and return their Linear identifier and URL.
- Read the full description, comments, labels, status, assignee, parent, and blocking relationships.
- Preserve existing labels when applying mapped category or disposition roles; some connector update operations replace the complete label set.
- Use Linear parent/sub-issue and blocking relationships, not prose alone. Keep human-readable `Parent` and `Blocked by` sections when a publishing skill requires them.
- Post triage comments with the disclaimer required by the `triage` skill.
- Use the team's backlog/unstarted/started/completed/canceled statuses consistently and record their exact names here.

Do not infer GitHub as canonical merely because `git remote` points there. A configured GitHub sync is a compatibility surface, not a second source of truth. After a fallback write, verify the synced Linear issue before reporting success; never create the same item independently in both systems.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the configured team. Apply the mapped category and disposition labels required by the skill.

## When a skill says "fetch the relevant ticket"

Resolve the Linear identifier or URL and fetch the issue plus comments and relationships.

## Wayfinding operations

- **Map:** a Linear issue labelled `wayfinder:map`.
- **Child ticket:** a sub-issue of the map labelled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking:** Linear's native blocking relationship. Create tickets first, then wire their blocking edges once identifiers exist.
- **Frontier:** open, unassigned child issues whose blockers are all closed.
- **Claim:** assign the ticket to the driving dev before doing any work.
- **Resolve:** post the answer as a comment, close the ticket, and append a linked one-line gist to the map's Decisions-so-far.
