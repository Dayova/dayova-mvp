# Issue tracker: Linear

Linear is the source of truth for issues and PRDs in this repo.

- Workspace: `dayova`
- Team: `Dayova`
- Team key: `DAY`
- Backlog status: `Backlog`
- Unstarted status: `Todo`
- Started status: `In Progress`
- Review status: `In Review`
- Completed status: `Done`
- Canceled status: `Canceled`
- Issue identifiers: `DAY-<number>`
- Synced GitHub repo: `Dayova/dayova-mvp`
- External PRs as a triage request surface: `no`

Use Linear identifiers and URLs in new docs, issue bodies, comments, dependency links, branch names, and handoffs. When Linear and GitHub disagree, inspect the Linear sync state and treat Linear as canonical.

## Agent access

Prefer the Linear plugin's semantic tools when they are exposed in the current task. The hosted Linear MCP is an equivalent semantic surface and is configured with:

```sh
codex mcp add linear --url https://mcp.linear.app/mcp
codex mcp login linear
```

If both the plugin and MCP expose overlapping operations, use one surface for the workflow; never repeat a mutation through both. If the current Codex task still does not expose Linear tools after setup, start a new task so it can load the configured connector.

Do not claim a Linear operation succeeded unless the connector returned the created or updated object. Do not use browser automation as the default issue-tracker API.

## Conventions

- **Create**: create the issue in team `DAY`, then return its `DAY-<number>` identifier and URL.
- **Read**: fetch the full description, comments, labels, status, assignee, relationships, creator, and timestamps.
- **List**: filter within team `DAY` using the mapped triage roles in `triage-labels.md`.
- **Comment**: post to the Linear issue. Triage comments must retain the AI disclaimer required by the `triage` skill.
- **Apply a triage outcome**: keep exactly one mapped category role and one mapped triage disposition role.
- **Labels**: a Linear issue update replaces the complete label set. Read the issue first and preserve unrelated labels while replacing conflicting mapped roles.
- **Dependencies**: use Linear `parentId` and native `blockedBy`/`blocks` relationships. Also keep the human-readable `Parent` and `Blocked by` sections required by `to-tickets`.
- **Ready work**: new `to-spec` and approved `to-tickets` output goes to `Todo` with one mapped category role and the mapped `ready-for-agent` role unless the user chooses another state.
- **Start/review/finish**: use `In Progress`, `In Review`, and `Done`. Existing PR automations already advance linked issues through these statuses.
- **Reject**: apply the mapped `wontfix` role, explain the decision, then use `Canceled`.

Publish dependency slices in dependency order so later issues can reference real Linear identifiers. Add native blocking edges after the issues exist. Do not close or modify a parent issue when `to-tickets` says not to.

## Wayfinding operations

All required labels are configured for team `DAY`:

| Role | Linear label | GitHub sync label |
| ---- | ------------ | ----------------- |
| Map | `wayfinder:map` | `wayfinder:map` |
| Research ticket | `wayfinder:research` | `wayfinder:research` |
| Prototype ticket | `wayfinder:prototype` | `wayfinder:prototype` |
| Grilling ticket | `wayfinder:grilling` | `wayfinder:grilling` |
| Task ticket | `wayfinder:task` | `wayfinder:task` |

- **Create the map**: create a `Backlog` issue with `wayfinder:map`.
- **Create child tickets**: create each issue with the map's identifier as `parentId` and the matching `wayfinder:<type>` label. Create all children first, then wire their `blockedBy` edges.
- **Find the frontier**: list open children by `parentId`, then read candidate relations and retain only unassigned issues whose blockers are all closed. Use map order as the tie-breaker.
- **Claim**: update the selected ticket with `assignee: "me"` before any investigation. Move it to `In Progress` when work starts.
- **Resolve**: post the resolution as a Linear comment, move the ticket to `Done`, then update the map's `Decisions so far` with a linked one-line gist.

Wayfinder labels are operational labels, not triage roles. Do not substitute them for the mappings in `triage-labels.md` or add triage roles unless the issue is intentionally entering triage.

## GitHub compatibility surface

Linear currently syncs GitHub Issues for `Dayova/dayova-mvp` with team `DAY` in both directions. Titles, descriptions, status, labels, assignees, and comments are expected to sync.

If Linear tools are unavailable, `gh` is an allowed compatibility path only for an issue that is or will be part of that configured sync:

- Create: `gh issue create --repo Dayova/dayova-mvp --title "..." --body "..."`
- Read: `gh issue view <number> --repo Dayova/dayova-mvp --comments`
- List: `gh issue list --repo Dayova/dayova-mvp --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --repo Dayova/dayova-mvp --body "..."`
- Labels: `gh issue edit <number> --repo Dayova/dayova-mvp --add-label "..." --remove-label "..."`
- Close: `gh issue close <number> --repo Dayova/dayova-mvp --comment "..."`

After a GitHub fallback write, verify that the Linear counterpart exists and synced successfully before reporting the Linear operation as complete. Never create the same work item independently in both systems.

## Skill phrases

When a skill says "publish to the issue tracker," create a Linear issue in team `DAY`.

When a skill says "fetch the relevant ticket," resolve a `DAY-<number>` identifier or Linear URL and fetch the full issue, comments, and relationships. Resolve a bare GitHub issue number through the synced GitHub issue only when the user clearly meant GitHub.
