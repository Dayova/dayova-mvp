---
name: maintain-dayova-agent-system
description: Maintain Dayova's repository agent system. Use when creating, updating, reviewing, or retiring repository skills; changing AGENTS.md, docs/agents, or routing contracts in docs/contexts; changing skill composition/update scripts, governance, authorization, or evaluation policy; or adopting an upstream skill release. Route ordinary product code, general documentation, personal/global skills, and event-scoped Linear Agent or Luma operations to their owning workflows when the repository contract is unchanged.
---

# Maintain Dayova's agent system

Treat the agent system as a reviewed product surface. Preserve one owner for each
kind of truth and one governed path from upstream input to repository behavior.

## Workflow

1. Read [`docs/agents/agent-system.md`](../../../docs/agents/agent-system.md),
   [`scripts/agent-system-governance.mjs`](../../../scripts/agent-system-governance.mjs),
   and the owning Linear issue. Read the source-specific maintenance guide for
   any upstream catalog being changed. Finish discovery only when every affected
   skill, source, route, authorization boundary, and evaluation is named.
2. Inspect the worktree, integration base, existing branch or stack, and current
   pull request. Choose evidence that demonstrates the change using the contract
   in `docs/agents/agent-system.md`. Capture a baseline before editing when a
   before/after comparison is useful; for stacked work, use the actual parent.
   Internal skill, instruction, or tooling changes with no observable product
   effect can use the diff, validation results, and behavioral evaluations without
   screenshots or recordings. Complete this step when the base and relevant
   evidence are identified.
3. Classify every proposed fact or action by owner: Notion for durable company
   knowledge and decisions, Linear for executable work, GitHub for code and
   evidence, and repository docs for code-adjacent contracts. Link across owners;
   keep one source of truth. Complete this step when every proposed fact and
   action has exactly one owner and the cross-system pointers are named.
4. Produce and inspect the proposed composition diff before accepting it. Pin
   upstream input, preserve the curated set and patch queue, and retain explicit
   Dayova metadata overrides. Use the repository composition command rather than
   an upstream installer. Complete this step when every composed hunk has an
   identified upstream or Dayova owner and no unreviewed input remains.
5. Update the governance manifest in the same change. Account for every affected
   source and skill: owner, inclusion rationale, trigger boundary, invocation,
   inputs, outputs, artifacts, systems, authorization class, override rationale,
   eval suite, last review, and retirement criteria. Complete this step when
   catalog validation accounts for every installed source and skill.
6. Turn an observed agent failure, human correction, or sanitized trace into the
   smallest realistic regression case before changing instructions. Reproduce
   the failure, add the case to the owning suite, then make the narrowest change
   that turns it green. Reconcile reusable executable follow-up into Linear after
   searching existing work. Complete this step when the case is red against the
   old behavior, green against the change, and linked to its owning work.
7. Validate every changed skill with the skill-creator validator, run
   `pnpm skills:validate`, and execute the affected behavioral cases. Dogfood a
   changed high-risk workflow on a bounded Dayova task. Completion requires the
   structural checks and every in-scope regression to pass.
8. Review the complete diff and publish through the branch or Graphite stack
   owned by the work. Explain the evidence choice in the PR, attach selected media
   directly, and link the implementation evidence from the relevant Linear issue.
   Follow the contract's media-presentation guidance in descriptions and comments:
   use compact previews with original links and check the published rendering on
   laptop and narrow viewports. Do not assume HTML sizing works in every client
   or treat an unchecked client as verified.
   Keep the PR draft when evidence needed to assess the change is missing.
   Completion means the reviewed PR, relevant evidence, validations, and Linear
   acceptance evidence identify the same delivered scope.

Keep maintained evaluation cases in the repository. Publish dated validation
reports and sanitized execution traces on the owning PR or Linear issue; keep
local capture artifacts ignored or temporary. Never treat an old passing report
as validation of the current commit.

## Source routes

- Matt Pocock: follow
  [`docs/agents/matt-pocock-skills.md`](../../../docs/agents/matt-pocock-skills.md).
- Expo: follow
  [`docs/agents/expo-skills.md`](../../../docs/agents/expo-skills.md).
- Convex: preserve the current pins and follow
  [`DAY-226`](https://linear.app/dayova/issue/DAY-226/decide-and-implement-upstream-update-handling-for-convex-skills)
  until Dayova adopts a composition policy.
- Dayova-owned skills: keep company workflow rationale in Notion and only the
  repeatable repository procedure in the skill.

Use the positive and negative routing cases in
[`maintain-dayova-agent-system.json`](../../evals/maintain-dayova-agent-system.json)
when changing this skill's trigger boundary.
