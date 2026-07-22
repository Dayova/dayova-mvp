---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams. If the seams are not explicit, state the seams you will use before coding; ask only when the choice materially changes the design.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Follow the repository's delivery policy. For Dayova implementation work, validate the result, commit only the in-scope changes, and push the non-default feature or PR branch unless the user explicitly asks to keep the work local. Never push the default branch or stage unrelated changes. If safe delivery is blocked, report the blocker instead of silently leaving completed work unpublished.
