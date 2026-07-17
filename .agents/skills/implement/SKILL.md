---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams. If the seams are not explicit, state the seams you will use before coding; ask only when the choice materially changes the design.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit only when the user requested a commit or the issue workflow explicitly requires one. Otherwise leave the completed changes in the worktree and report the files changed plus the validation run.
