# Dayova agent-system contract

This is the repository-facing contract for Dayova's agent system. The approved
architecture and rationale remain in
[Notion](https://app.notion.com/p/3b42e87228bf816e9343c3fc33fa73ca);
[DAY-332](https://linear.app/dayova/issue/DAY-332/codify-dayovas-agent-system-architecture-and-skill-governance-contract)
owns this implementation. Keep this document to code-adjacent rules and links.

## Ownership boundaries

| Surface | Canonical responsibility |
| --- | --- |
| Notion | Durable company knowledge, operating principles, decisions, and rationale |
| Linear | The only executable-work system: scope, owner, status, priority, dependencies, and acceptance criteria |
| GitHub | Code, commits, checks, pull requests, reviews, and implementation evidence |
| Root `AGENTS.md` | Short always-on non-negotiables and routes into conditional guidance |
| Repository skills | Repeatable workflows whose behavior changes repository work |
| `docs/agents` and `docs/contexts` | Detailed code-adjacent contracts and pointers to canonical knowledge |
| User/global skills | Personal or cross-repository mechanics |
| Linear Agent and Luma | Authorized, event-scoped, idempotent operations and reconciliation |

Resolve disagreement within the owning boundary. Reconcile drift instead of
declaring one global system more authoritative than all others.

## Repository skills, Linear Agent, and Luma

A repository skill packages a conditional workflow used while changing or
evaluating this repository. It may read other systems, but it does not become a
company handbook or a task catalog.

A Linear Agent skill packages an operation that runs in Linear's execution
context. It must use Linear issues as the work objects and preserve their native
ownership, state, dependency, and idempotency semantics. Keep reusable coding
workflow details in the repository and link them when the operation needs them.

Luma reconciles events, meetings, decisions, and follow-ups across their owning
systems. It may search, link, update, or create Linear work within its granted
authority. It must not mirror all repository skills, create a second backlog, or
turn Notion into an executable-work database. Its organizational contract lives
in [Notion](https://app.notion.com/p/39f2e87228bf81bcbce2d45921dd4e18).

## Machine-readable governance

[`scripts/agent-system-governance.mjs`](../../scripts/agent-system-governance.mjs)
is the maintained manifest. Its resolved source and skill records contain:

- source and exact pin location;
- Dayova owner and repository inclusion rationale;
- positive and negative trigger boundaries;
- implicit, explicit, or non-invocable policy;
- inputs, outputs, and artifacts;
- systems read and written;
- mutation and authorization class;
- local override rationale;
- structural and behavioral evaluation suites;
- last review and retirement criteria.

Each skill's input, output, and artifact entries point to the completion contract
in its own `SKILL.md`. This keeps the manifest complete without copying volatile
procedure into a second authority.

`pnpm skills:validate` requires one record for every repository skill and every
maintained source. Missing, unmatched, or unowned records fail validation.
Review dates are owner-maintained; the validator checks their format, while the
review cadence below defines when an actual review is due.

## Task execution route

`$dayova-task` is the shared implementation entry point for descriptions, Linear
IDs/URLs, and optional device/OS/appearance/reproduction preferences. Its
[skill](../../.agents/skills/dayova-task/SKILL.md) selects existing specialist
workflows; [resource scripts](../../scripts/dayova-task/resources.mjs) maintain
chat/worktree ownership, exact fresh iOS simulator allocation and Metro leases.
Provider verification remains an explicit agent responsibility, recorded as a
credential-free receipt and checked against the runtime's public configuration.
The helper does not provision or certify cloud isolation and never deploys.

[DAY-553](https://linear.app/dayova/issue/DAY-553), under DAY-221, owns this route.
Resource behavior runs through `pnpm test:unit:task-resources`; realistic routing
and failure cases live in `.agents/evals/dayova-task.json`. Keep current execution
evidence on the PR/issue. No upstream skill or composition pin changes here.

The skill is repository-local: before merge it is available in checkouts of its
PR branch (start a chat there, or point to that checkout's SKILL.md if the current
catalog is stale). After merge and pulling the integration branch, collaborators
can invoke `$dayova-task` from Dayova-MVP. It is not installed globally and does
not automatically appear in older worktrees.

## Maintenance route

Use `$maintain-dayova-agent-system` for changes to repository skills,
`AGENTS.md`, agent-facing contracts, composition scripts, routing,
authorization, evaluations, or source adoption. Its positive, negative, and
mutation-safety cases live in
[`maintain-dayova-agent-system.json`](../../.agents/evals/maintain-dayova-agent-system.json).
Keep dated execution results and sanitized traces on the owning PR or Linear
issue, with the tested commit, environment, and limitations. Maintained fixtures
stay beside the validation tools; a historical passing report is not a runtime
evaluation of today's catalog. The original bounded forward-test record is
preserved as [historical PR evidence](https://github.com/Dayova/dayova-mvp/pull/450#issuecomment-6253901689).

The workflow must keep these transitions explicit:

1. Detect an upstream or local need without mutating the catalog.
2. Find the owning Linear issue and enumerate affected sources, skills, routes,
   authorizations, and evaluations.
3. Choose relevant evidence, capture a comparison baseline when useful, and
   produce a proposed composition diff.
4. Apply the curated policy, pinned input, patch queue, and metadata overrides.
5. Update this contract and the governance manifest when their behavior changes.
6. Run structural checks, affected regression cases, and a bounded dogfood task.
7. Publish a reviewed GitHub change with the evidence required by
   [DAY-271](https://linear.app/dayova/issue/DAY-271/enforce-before-and-after-screenshots-and-screen-recordings-on-every).

The repository owns the evidence contract below. Use the authenticated GitHub
CLI's `--attach` support for selected media, following the session's GitHub
evidence guidance. User-facing plans and pull requests also
require the distinct Dayova product-quality review tracked by
[DAY-289](https://linear.app/dayova/issue/DAY-289/add-a-dayova-product-quality-reviewer-for-plans-and-user-facing-pull).
For internal tooling, documentation, infrastructure, and pure refactors, record
lightweight product triage and skip full product review when observable product
behavior is unchanged. Missing tooling for a required user-facing review is an
explicit workflow gap; generic code review does not replace it.

Source-specific composition remains in
[`matt-pocock-skills.md`](matt-pocock-skills.md) and
[`expo-skills.md`](expo-skills.md). Convex source maintenance remains an explicit
decision in
[DAY-226](https://linear.app/dayova/issue/DAY-226/decide-and-implement-upstream-update-handling-for-convex-skills).

## Pull-request evidence

Choose evidence that lets a reviewer assess the actual change:

- Static visual changes, such as a button color: before/after screenshots.
  A recording adds no value unless motion, interaction, or timing also changes.
- Motion, interaction, or timing changes: before/after recordings when the
  behavior needs to be seen over time. Add screenshots only when a still
  comparison helps review a visual change.
- Performance improvements: comparable before/after measurements using the same
  scenario and environment. For user-visible latency, prefer recordings with a
  visible timer. Backend-only performance changes can use benchmarks or traces.
- Backend, refactor, tooling, or documentation changes with no observable product
  effect: relevant tests, logs, generated output, or other checks. Screenshots
  and recordings are not required merely to show a terminal or an unchanged UI.

For mixed changes, cover each affected behavior without collecting redundant
media. Explain the evidence choice and any limits in the PR. Attach selected
media directly to the PR; include check results and durable verification links
there as appropriate. Record the tested revision and environment. Keep generated
local artifacts ignored or temporary.

When comparison evidence is useful, capture the baseline before editing and
compare the same scenario on the PR head. For a stacked PR, use its actual parent
as the baseline. If relevant evidence cannot be obtained, keep the PR draft and
state what is missing. Omitting irrelevant media is not an evidence blocker.
Apply `inspect-video-evidence` when making claims from recordings.

The canonical policy is the
[review and evidence checklist](https://app.notion.com/p/3dc2e87228bf81c69e43cadf318c2d9f).
[DAY-271](https://linear.app/dayova/issue/DAY-271) owns capture and enforcement;
the earlier universal four-artifact requirement is superseded by Jakob's
change-specific evidence policy.

### Media presentation

Evidence should remain easy to scan in GitHub PR descriptions and comments,
including laptop windows and narrow clients. Large source images are for
inspection, not an instruction to display a phone capture at the full PR width.

- As a starting point, fit image previews inside a **640 × 560 pixel** box without
  enlarging small originals or changing their aspect ratio. A 1080 × 2400 phone
  screenshot becomes about 252 × 560; a 1280 × 800 desktop capture becomes
  640 × 400. Adjust when necessary for legibility and the rendered viewport.
- Attach a compact preview image and link the original at full resolution.
  Explicit numeric `width` and `height` on an HTML image can control its web
  presentation, but the preview file itself should also be compact so clients
  that ignore HTML sizing still receive a sensible fallback. Preserve the
  original separately; never replace or distort the source evidence.
- Label Before/After and use the same scale for comparable captures. Prefer a
  simple vertical sequence to wide, multi-column tables on narrow screens. If
  details become unreadable, add a clearly labeled detail crop or original link
  rather than enlarging every full-device screenshot.
- Keep recordings compact and preserve their aspect ratio, readable timers,
  duration, and timing. Where a client makes a portrait player unwieldy or does
  not embed it, provide a compact poster and a clearly labeled link to the
  attached recording. A poster is navigation, not temporal evidence. Do not
  assume custom CSS or HTML video dimensions work in every GitHub client.
- Inspect the published description **and evidence comments**, at normal zoom
  in a laptop-sized viewport and a narrow viewport. Check that previews do not
  dominate the page, labels remain readable, and original/video links work.
  Verify additional clients when available or reported as problematic. Name the
  surfaces actually checked; one web renderer does not prove every client works.

For GitHub web, a compact preview may use this markup after uploading both files:

```html
<a href="ORIGINAL_ASSET_URL"><img src="PREVIEW_ASSET_URL" alt="Before — affected screen" width="252" height="560"></a>
```

Also supply a plain labeled original link. If a client strips HTML, use a
Markdown-linked compact preview as the fallback. This presentation guidance
does not require media for changes whose relevant evidence is non-visual.

## Regression loop

Treat an observed agent failure, a human correction, and a sanitized execution
trace as candidate evaluation evidence:

1. Preserve the smallest prompt and context that reproduce the behavior. Remove
   credentials, personal data, production records, and irrelevant conversation.
2. Classify the failure: selection, non-selection, instruction following,
   artifact quality, source ownership, or unauthorized mutation.
3. Search Linear. Update the existing owning issue or create one only when the
   failure is real, reusable, and worth retaining. Follow
   [DAY-269](https://linear.app/dayova/issue/DAY-269/define-when-agents-should-fix-discovered-problems-immediately-vs)
   for fix-now, capture/reconcile, or discard.
4. Add the minimized case to the suite named by the affected manifest record.
   Record expected selection and non-selection, permitted systems, allowed
   mutation, and the expected artifact or decision.
5. Reproduce the case before changing instructions. Then change the smallest
   authoritative surface and rerun the case plus its neighbors.
6. Link the passing trace and pull-request evidence from the Linear issue. Put
   durable organizational learning in Notion only when the lesson outlives the
   repository implementation.

[DAY-227](https://linear.app/dayova/issue/DAY-227/add-behavioral-trigger-checks-for-the-repo-local-skill-catalog)
owns catalog-wide runtime trigger automation. This contract supplies the case
shape and prevents a future harness from becoming another source of policy.

## Review and retirement

The owner reviews every manifest record at least once per calendar quarter and
also after an upstream release, a material routing or authorization failure, a
source-of-truth change, or six months without a successful invocation. Update
`lastReviewed` only after checking the skill body, metadata, overrides, current
triggers, evaluation evidence, and overlap with plugins or neighboring skills.

Retire or merge a skill when its trigger is no longer distinct, its workflow is
unused or consistently bypassed, another maintained surface owns the same job,
its source can no longer be pinned or safely composed, or its maintenance cost
exceeds measured value. Retirement requires a Linear issue, removal from the
catalog and governance manifest, routing and link cleanup, validation of nearby
skills, and a reviewed pull request. Preserve durable rationale in Notion; do not
keep an obsolete skill merely as historical documentation.

## Related owned work

- [DAY-492](https://linear.app/dayova/issue/DAY-492): GitHub PR and native-stack workflow; follow the [developer handbook](https://app.notion.com/p/3dc2e87228bf815e890fc5f1397c4940). Graphite adoption (DAY-181) is canceled.
- [DAY-269](https://linear.app/dayova/issue/DAY-269/define-when-agents-should-fix-discovered-problems-immediately-vs): fix now, capture/reconcile, or discard.
- Change-specific pull-request evidence: [DAY-271](https://linear.app/dayova/issue/DAY-271), [DAY-272](https://linear.app/dayova/issue/DAY-272), [DAY-273](https://linear.app/dayova/issue/DAY-273), [DAY-274](https://linear.app/dayova/issue/DAY-274), [DAY-275](https://linear.app/dayova/issue/DAY-275), [DAY-276](https://linear.app/dayova/issue/DAY-276), and [DAY-277](https://linear.app/dayova/issue/DAY-277).
- [DAY-289](https://linear.app/dayova/issue/DAY-289/add-a-dayova-product-quality-reviewer-for-plans-and-user-facing-pull): Dayova product-quality review.
- [DAY-334](https://linear.app/dayova/issue/DAY-334/reduce-the-implicit-skill-catalog-and-enforce-a-routing-context-budget): routing-context budget.
