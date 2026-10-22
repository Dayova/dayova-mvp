---
name: dayova-task
description: Take a Dayova implementation task from a description or Linear issue through isolated local setup, validation, and a draft PR. Use for end-to-end task execution; keep review-only, diagnosis-only, and release requests in their specialist workflows.
---

# Dayova task

Accept a description, DAY issue ID/URL, or both, followed by optional device,
OS, appearance, and reproduction preferences. For example:
`$dayova-task DAY-123 — fix the calendar jump. Use iPhone 17 Pro, dark mode.`
An issue ID alone means implement its acceptance criteria. Preserve supplied
reproduction steps and preferences; reconcile conflicting issue/prompt scope
before implementation. Never silently substitute a requested device or OS.

1. **Discover.** Read root `AGENTS.md`, `CONTEXT-MAP.md`, the issue (including
   links, dependencies and existing PR), and relevant canonical Notion guidance.
   For description-only requests, search Linear before creating work. State the
   outcome, assumptions, relevant skills, intended base, and evidence choice.
   Use the [routing and delivery reference](references/workflow.md); load only
   skills needed for this task, not every catalog.
2. **Own the workspace.** Follow the [resource procedure](references/resources.md).
   Probe `.git` and `.agents` before setup. Inspect attached worktrees, current
   branch, dirty files and stack. Resume only a matching owned ledger; otherwise
   create a managed worktree from the task's reviewed integration base and a new
   scoped `codex/` branch. Failed access or managed creation is a blocker, not
   permission to bypass restrictions. Preserve unrelated changes.
3. **Prepare verification.** For app work, create a dedicated simulator of the
   requested model and OS, set appearance, and allocate a separate Metro port.
   “17 Pro” means a new **iPhone 17 Pro**, never another chat's device. Verify
   actual backend type, Clerk issuer, account and fixture ownership before login
   or data writes. Prepare a compatible development build, supported synthetic QA
   login and task data using [the setup reference](references/resources.md).
   Worktrees, app IDs and EAS profile names do not establish backend isolation.
4. **Deliver.** Capture the baseline from the actual PR parent when comparison
   evidence matters, reproduce, implement, and validate the affected behavior.
   Apply root test-quality rules. Review the full change against standards and
   issue scope, and perform distinct Dayova product-quality review where required.
   Commit coherent changes, push only the owned branch, and create/update its
   draft PR using Dayova's description/evidence contract. Link actual results and
   limitations to the owning Linear issue; don't finish a parent program for a
   partial slice. Never merge or deploy from this workflow.
5. **Close resources.** Stop only owned terminals/processes and remove only owned
   devices/fixtures with verified cleanup authority. Preserve the published
   branch and reviewable worktree; archive a managed worktree only when no longer
   needed. Report the PR, checks, evidence gaps, cleanup state and exact next
   invocation. A blocked setup may still permit independent code work, but never
   claim unperformed device, login, backend or product validation.

Completion: a reviewed draft PR with acceptance evidence, linked Linear work,
and a resource ledger accounting for retained and cleaned resources. Generated
evidence stays ignored/temporary and is published on the PR or issue.
