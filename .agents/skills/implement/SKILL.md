---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams. If the seams are not explicit, state the seams you will use before coding; ask only when the choice materially changes the design.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Follow the repository's delivery policy. For explicitly mutating Dayova repository work, validate and review the result, then commit only the coherent in-scope changes. Publish only to a branch that already represents the current work item or pull request, or a new branch intentionally created for this work from the correct integration base. Preserve an existing pull request and stack. Never treat “non-default” alone as authorization to push, push the default branch, or stage unrelated changes. If safe delivery is blocked, report the blocker instead of silently leaving completed work unpublished.
