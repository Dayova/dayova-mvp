# Triage Labels

The skills use two category roles and five triage disposition roles. Map them to these exact labels; similarly named labels are not interchangeable.

## Category roles

| Role in mattpocock/skills | Linear label  | GitHub sync label | Scope     | Meaning                    |
| ------------------------- | ------------- | ----------------- | --------- | -------------------------- |
| `bug`                     | `Bug`         | `bug`             | Workspace | Something is broken        |
| `enhancement`             | `enhancement` | `enhancement`     | Team      | New feature or improvement |

## Triage disposition roles

| Role in mattpocock/skills | Linear label      | GitHub sync label | Scope | Meaning                                   | Current Linear setup |
| ------------------------- | ----------------- | ----------------- | ----- | ----------------------------------------- | -------------------- |
| `needs-triage`            | `needs-triage`    | `needs-triage`    | Team  | Maintainer needs to evaluate this issue   | Configured           |
| `needs-info`              | `needs-info`      | `needs-info`      | Team  | Waiting on reporter for more information  | Configured           |
| `ready-for-agent`         | `ready-for-agent` | `ready-for-agent` | Team  | Fully specified, ready for an AFK agent   | Configured           |
| `ready-for-human`         | `ready-for-human` | `ready-for-human` | Team  | Requires human implementation or judgment | Configured           |
| `wontfix`                 | `wontfix`          | `wontfix`         | Team  | Will not be actioned                       | Configured           |

Every triaged issue must have exactly one mapped category role and one mapped triage disposition role. Other product labels such as `Feature` and `Improvement` may coexist, but they do not satisfy the Matt Pocock category-role requirement. Use the Linear column for Linear operations and the GitHub sync column only when using the documented compatibility fallback.

Before applying a new category or disposition, remove any conflicting label from the same table. Linear workflow statuses are orthogonal to these labels: use `Backlog` while intake is unresolved, `Todo` when work is ready, `In Progress`/`In Review` during delivery, `Done` for completed work, and `Canceled` for `wontfix`.

If a required mapped label does not exist, stop and report the missing Linear configuration. Do not silently substitute a status or a similarly named label.
