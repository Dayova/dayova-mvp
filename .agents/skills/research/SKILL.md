---
name: research
description: Investigate a question against high-trust primary sources. Use when the user wants a topic researched, docs or API facts gathered, or a durable cited research note for another workflow.
---

Investigate against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it.

Default output is an inline answer with citations. Create a Markdown file only when the user asks for a durable artifact, a tracker ticket needs a context pointer, or another skill explicitly requires one.

When a durable note is needed:

1. Write the findings to a single Markdown file, citing each claim's source.
2. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.
3. Link the file from the issue, map, or handoff that needs it.

Use a background subagent only when the research is broad enough to benefit from parallel work and the current Codex environment permits subagents. Otherwise research in the current turn. Do not create a branch unless the parent workflow explicitly asks for one and the user has authorized branch side effects.
