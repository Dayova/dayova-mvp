# Context, routing and delivery

Use `CONTEXT-MAP.md` to find canonical Notion context. Read the developer
handbook's branch, PR-writing, evidence and environment pages for implementation.
The repository contract is [agent-system.md](../../../../docs/agents/agent-system.md).
Follow its current change-specific evidence policy if an older PR template still
asks for four media artifacts. Read [testing.md](../../../../docs/testing.md) for
the affected validation seam. Fetch the issue even when the prompt has a summary.

Select existing workflows by the actual uncertainty/change:

| Need | Route |
| --- | --- |
| Broken or slow behavior needs diagnosis | `diagnosing-bugs` |
| Module boundary, domain contract, unresolved design | `codebase-design`, `domain-modeling`, `prototype` as applicable |
| User requested test-first work | `tdd` |
| Review completed changes | `code-review` with the actual parent SHA and owning issue |
| Substantial product UI/interaction decision | `dayova-product-design`; distinct product-quality review per DAY-289 |
| Native UI, navigation, network, native module or dev client | Relevant `expo-native-ui`, `expo-ui`, `expo-router`, `expo-data-fetching`, `expo-module`, `expo-dev-client` |
| Convex change | Read `convex/_generated/ai/guidelines.md`; use available `convex:convex-expert` and the relevant repo auth/component/migration/performance skill |
| Video attached to an issue | `inspect-video-evidence` before temporal claims |
| Agent workflow, skill, governance change | `maintain-dayova-agent-system` |

These are routes, not automatic calls to every skill or upstream installers.
Use composed repository Expo/Matt guidance; keep upstream pins and patch queues.
If a needed skill is unavailable, follow its documented fallback or surface the
gap. Do not treat generic code review as product-quality review. Internal tooling
with unchanged product behavior gets the contract's lightweight product triage.

Choose the base from issue/PR/release/stack evidence. Independent work may use
the established integration branch; dependent work keeps its actual parent.
Record both ref and resolved SHA. Resume the owned PR for in-scope follow-up;
an unrelated task gets a separate worktree, branch and PR. Use GitHub native
stacks when dependent; never Graphite. Ambiguous ownership/base needs clarification.

PR writing follows the [canonical guide](https://app.notion.com/p/3dc2e87228bf81d08e22d620ebcedf36):
concrete problem and resulting behavior, meaningful tradeoffs, Linear link and
actual base, exact validation/environment/results, remaining limitations, and
release impact. Apply the linked evidence contract: static changes need matching
screenshots; temporal changes need recordings; performance claims need comparable
measurements; tooling/backend-only changes can use tests/logs. Capture baseline
before editing, attach selected evidence directly with compact previews and full
original links, and inspect published laptop/narrow rendering. Keep draft when
required evidence is missing. No merge, deployment, paid cloud build or evaluation
is implied by invoking this task skill.
