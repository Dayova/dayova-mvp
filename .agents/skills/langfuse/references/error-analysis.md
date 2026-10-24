---
name: langfuse-error-analysis
description: Deep-dive error analysis of an LLM pipeline or AI application using Langfuse traces.
  Use this skill whenever the user wants to understand why their AI system is producing
  bad outputs, where their pipeline is failing, or how to categorise and label failures
  into a taxonomy and decide what to prioritise fixing. Also trigger for "review my
  traces", "my outputs look wrong", "help me debug my LLM app", "I want to analyse
  errors", "build a failure taxonomy", or "what's going wrong with my pipeline".
---

# Error Analysis

## Dayova production contract

Read `ai/README.md` before following this workflow. Dayova excludes prompts,
outputs, answers, and uploaded material from every production observation,
including GENERATION observations. Production traces support analysis of
operational metadata such as errors, retries, latency, usage, and cost.
For content-based open coding, use approved synthetic evaluation data in the
separate evaluation project. Do not enable production content capture, copy
learner content into annotations, or create a content-review queue from empty
production observations. Verify that the permitted synthetic content is present
before creating the queue, and leave human labels to the reviewer.

## Primary Guide

**1. Fetch the guide in this blogpost**

https://langfuse.com/guides/cookbook/error-analysis-llm-applications.md

If fetch is not available query for langfuse.com error analysis guide

Read it in full. It defines the authoritative 5-step process (sample selection → open coding → clustering → labelling → deciding what to fix).

**2. Guide the user through this step by step**

You as a coding agent and the user go through this together to perform a full error analysis with their data in Langfuse. Set up the scores, representative sample, and annotation queue for the user, and provide direct UI links wherever their action is required. Be proactive and explain what is happening in plain language without reciting internal step numbers or jargon.

## Rules CRITICAL
- Perform interactions with the user's Langfuse instance yourself rather than telling the user to do them.
- The user performs the open-coding review and supplies human labels; do not do this on their behalf.
- Where a step needs the user's judgment or input, pause and ask before acting.
- Use charts where possible to display data.

---

## Langfuse Implementation Notes

The guide describes the process. These notes cover the Langfuse-specific mechanics required to execute it.

### Credentials

Make sure Langfuse credentials are available before starting — a public key (`pk-lf-...`), a secret key (`sk-lf-...`), and the host (e.g. `https://cloud.langfuse.com` for EU, `https://us.cloud.langfuse.com` for US, `https://jp.cloud.langfuse.com` for JP, or a self-hosted URL). If they aren't configured, ask the user to set them — do not ask them to paste secret values into chat.

Verify you can actually reach the user's project before proceeding. If access fails, stop and ask the user to check their credentials and host.

### Annotation target: OBSERVATION versus TRACE

> **CRITICAL:** Null trace-level `input`/`output` does not imply that another observation contains content. Check the Dayova production contract first. Only where content capture is permitted, such as approved synthetic evaluations, inspect the GENERATION observation and queue it instead of the trace if it actually contains the material being reviewed. Empty production generations cannot support content-based review.

### Annotation queues

> **Public API limitation:** The documented public API does not expose queue-level update/delete endpoints. Create score configs before creating the queue with its config IDs. If later changes are needed, use the supported queue-editing UI or create a replacement queue through the API. The UI supports editing and deleting queues; queue items have their own API operations. Check current API/schema support for the target deployment before acting.


**Always give the user a direct link immediately after creating a queue:**

| Host | URL pattern |
|------|-------------|
| EU cloud | `https://cloud.langfuse.com/project/<projectId>/annotation-queues/<queueId>` |
| US cloud | `https://us.cloud.langfuse.com/project/<projectId>/annotation-queues/<queueId>` |
| Self-hosted | `<LANGFUSE_BASE_URL>/project/<projectId>/annotation-queues/<queueId>` |

For an approved synthetic content-review queue, ask the user to open code the
selected examples: describe the observed behavior in `open_coding`, then set
`pass_fail_assessment` to Pass or Fail. Do not ask for semantic judgments on
metadata-only production observations.


### Prompt fixes

When a category warrants a prompt fix, always offer the user two options:
1. Create it as a versioned prompt in Langfuse (tracked, usable via the prompt API)
2. Draft the specific text change for them to review and apply

### Setup evaluators

When a category warrants an evaluator, build it following `references/setting-up-evals.md`.


### Common gotchas

| Mistake | Fix |
|---------|-----|
| Expecting production generations to reveal content | Use operational metadata for production analysis; use approved synthetic evaluations for content review |
| Annotating an empty trace when approved synthetic content lives in an observation | Verify the content is present, then target that GENERATION observation |
| Creating a score config without checking existing ones | Check existing score configs first; they can't be deleted |
| Queue created before score configs | Create configs → collect IDs → create queue |
| Requesting too many traces at once | Page size is capped (max 100); paginate to get more |
| No rate limiting on bulk queue item creation | Space out requests to avoid hitting rate limits (429) |
