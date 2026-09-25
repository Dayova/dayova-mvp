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
maintained source. A missing, stale, or unowned record fails validation.

## Maintenance route

Use `$maintain-dayova-agent-system` for changes to repository skills,
`AGENTS.md`, agent-facing contracts, composition scripts, routing,
authorization, evaluations, or source adoption. Its positive, negative, and
mutation-safety cases live in
[`maintain-dayova-agent-system.json`](../../.agents/evals/maintain-dayova-agent-system.json).
The bounded fresh-agent execution result lives in
[`maintain-dayova-agent-system.forward-test.json`](../../.agents/evals/maintain-dayova-agent-system.forward-test.json).

The workflow must keep these transitions explicit:

1. Detect an upstream or local need without mutating the catalog.
2. Find the owning Linear issue and enumerate affected sources, skills, routes,
   authorizations, and evaluations.
3. Capture the real baseline and produce a proposed composition diff.
4. Apply the curated policy, pinned input, patch queue, and metadata overrides.
5. Update this contract and the governance manifest when their behavior changes.
6. Run structural checks, affected regression cases, and a bounded dogfood task.
7. Publish a reviewed GitHub change with the evidence required by
   [DAY-271](https://linear.app/dayova/issue/DAY-271/enforce-before-and-after-screenshots-and-screen-recordings-on-every).

The repository owns the required four-artifact outcome; the user's global GitHub
attachment skill owns upload mechanics. User-facing plans and pull requests also
require the distinct Dayova product-quality review tracked by
[DAY-289](https://linear.app/dayova/issue/DAY-289/add-a-dayova-product-quality-reviewer-for-plans-and-user-facing-pull).
Treat its absence as an explicit workflow gap rather than substituting generic
code review.

Source-specific composition remains in
[`matt-pocock-skills.md`](matt-pocock-skills.md) and
[`expo-skills.md`](expo-skills.md). Convex source maintenance remains an explicit
decision in
[DAY-226](https://linear.app/dayova/issue/DAY-226/decide-and-implement-upstream-update-handling-for-convex-skills).

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

- [DAY-181](https://linear.app/dayova/issue/DAY-181/adopt-graphite-as-the-required-stacked-change-workflow-for-humans-and): branch and Graphite stack workflow.
- [DAY-269](https://linear.app/dayova/issue/DAY-269/define-when-agents-should-fix-discovered-problems-immediately-vs): fix now, capture/reconcile, or discard.
- Four-artifact pull-request evidence: [DAY-271](https://linear.app/dayova/issue/DAY-271), [DAY-272](https://linear.app/dayova/issue/DAY-272), [DAY-273](https://linear.app/dayova/issue/DAY-273), [DAY-274](https://linear.app/dayova/issue/DAY-274), [DAY-275](https://linear.app/dayova/issue/DAY-275), [DAY-276](https://linear.app/dayova/issue/DAY-276), and [DAY-277](https://linear.app/dayova/issue/DAY-277).
- [DAY-289](https://linear.app/dayova/issue/DAY-289/add-a-dayova-product-quality-reviewer-for-plans-and-user-facing-pull): Dayova product-quality review.
- [DAY-334](https://linear.app/dayova/issue/DAY-334/reduce-the-implicit-skill-catalog-and-enforce-a-routing-context-budget): routing-context budget.
