# AI tracing, costs, and evaluations

Implementation for [DAY-219](https://linear.app/dayova/issue/DAY-219) and the
evaluation foundation in [DAY-293](https://linear.app/dayova/issue/DAY-293).
Product quality invariants and the rollout decision live in the canonical
[AI model strategy](https://app.notion.com/p/3ae2e87228bf81ccb1ccdbbc83c7709c).

## Agent skill

The official [Langfuse skill](../.agents/skills/langfuse/SKILL.md) and its
reference guides are installed in the repository for Codex. Invoke `$langfuse`
for tracing, costs, datasets, and evaluations; read this runbook alongside it
for Dayova's implementation contracts.

Source: [langfuse/skills at 127253d0](https://github.com/langfuse/skills/tree/127253d0e26dfa77fb6d732d1b70c36625581eb4/skills/langfuse).
Local changes add Dayova's production contract and correct automatic-capture
and Python OpenAI wrapper guidance in `references/instrumentation.md`, prefer
stable evaluator APIs in `references/setting-up-evals.md`, and clean up trailing
whitespace. The upstream MIT license is included.
`skills-lock.json` records the upstream source path and content hash.
To refresh only this skill, run
`pnpm exec skills add langfuse/skills --skill langfuse --agent codex --copy --yes`,
review the upstream changes, reapply those local corrections where still needed,
retain the license, update the source revision above, and run `pnpm skills:validate`.
Consult the [current CLI documentation](https://langfuse.com/docs/api-and-data-platform/features/cli)
before running the upstream CLI examples; new installs use `@langfuse/cli`.

## Backend tracing

Create EU Langfuse Cloud projects for development, staging and production.
Set these **in each corresponding Convex deployment** with `convex env set`
or the dashboard, using the project's own keys:

- `LANGFUSE_ENABLED=true`
- `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL=https://cloud.langfuse.com`
- `LANGFUSE_TRACING_ENVIRONMENT=development`, `staging`, or `production`
- `LANGFUSE_RELEASE`: the deployed commit SHA
- Optional `LANGFUSE_USER_HASH_SECRET`: a random per-environment secret for
  stable HMAC user IDs. Without it, traces have no user identity. Rotate it to
  sever the previous identity linkage. Never use names or emails as metadata.

No keys are committed or embedded in Expo. Disabled/unconfigured telemetry
leaves the app operational. Each action creates an independent operation trace;
every provider request (including AI SDK retries) has a generation observation.
Application validation attempts are nested spans. Parallel actions use isolated
async contexts, while parallel generations within one action share its trace.
The exporter is awaited at action completion and has a bounded flush timeout.
Telemetry setup/export failures do not change the learner result or error.

Production uses a **private OpenTelemetry provider**, without auto-instrumentation.
Only manually projected operational metadata, opaque entity IDs, optional HMAC
user ID, model/settings, timing, usage and sanitized error categories are sent.
It never records prompt bodies, outputs, files, URLs, transcripts, raw exceptions
or stack traces. There is deliberately no content-capture flag. Content retention
for real material needs an explicit privacy decision before implementation.
All operation traces are sampled at 100%; sampling would undercount spend.

For future non-streaming model calls, use `traceAiAction` at the action boundary,
`observeAiModel` around the model, and `withAiValidationAttempt` around the
generation plus its semantic validation. Streaming is not used in the app and
requires a separately tested stream lifecycle wrapper before adopting it.

## Costs in Langfuse

Use Langfuse's built-in cost/latency dashboards and generation filters:

- Environment and date range for daily/monthly totals.
- Model, generation name/`metadata.operation`, and HMAC user ID for attribution.
- Trace total for cost per completed user operation, including rejected attempts.
- Observation error level for provider failures and validation-attempt spans.
- Evaluation experiment for candidate quality, spend and latency comparisons.

Usage categories are disjoint: `input` excludes `input_cached`, and `output`
excludes `output_reasoning`. Provider totals already contain both categories;
adding them again would overcount. Explicit total USD estimates include cached
discounts and reasoning exactly once. Pricing is an exact model-ID lookup, never
a substring heuristic. The initial registry covers Gemini 3 Flash preview,
3.1 Flash-Lite and 3.5 Flash-Lite at **global Standard PayGo** rates reviewed
2026-10-18 against [Google pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing).
It excludes cache storage, grounding/tool charges, discounts, taxes and regional
surcharges. The app currently does not use charged grounding tools.

Unknown usage is absent, not zero. Provider errors often expose no usage and
must appear in the unknown-cost count. For unsupported models or non-global
regions, Dayova does not submit an explicit cost: configure the exact applicable
rates in Langfuse's model definitions and validate them against provider billing.
Langfuse may infer a cost from its own model definitions even when Dayova's
`costStatus` is `unknown`; inspect that metadata and reconcile provider invoices.
The existing Convex budget ledger remains separate and unchanged. Langfuse is
operational visibility, not a replacement for backend spending enforcement or
the provider invoice. Its Cloud subscription is a separate cost.

## Verify and troubleshoot

1. Run a synthetic test-account generation in development, including a failed
   attempt/retry. Open the latest operation in the correct Langfuse project.
2. Confirm all attempts share the operation trace, usage/cost is present when
   reported, and the release/environment match the deployed backend.
3. Inspect attributes and confirm no source text, answer, file URL or raw error
   appears. Compare a known request's tokens with the provider response.
4. Verify a disabled/invalid exporter leaves the learner flow working.

For missing traces, check the explicit enabled flag, both project keys,
environment, EU base URL, successful backend deployment and outbound access.
`[Dayova:aiObservability]` is a sanitized failure diagnostic. Never enable raw
SDK debug logs on production material. A hard process/action termination can
lose telemetry; totals are estimates, not a complete billing ledger.

## Repeatable model comparisons

`pnpm ai:eval` validates and prints a **dry-run plan** without provider requests
or Langfuse writes. The initial synthetic corpus expands into 90 cases across
diagnostics, plans, theory, practice, rehearsal and answer grading. It covers
grades 10–13 and mathematical, scientific, text and English material. Eight
source packs are for development and two are held out. All cases from a source
stay in the same split. The seed is **not teacher-validated** and cannot pass
the review gate until its references/rubrics have been reviewed.

The runner imports production generation schemas, theory instructions and the
exact answer-grading prompt. Generation fixtures provide deterministic synthetic
context; these are generation-contract tests, not full Convex scheduling/file
ingestion end-to-end tests. The corpus starts with text representations. Native
PDF/Office/image ingestion, sparse/conflicting materials and wider student
validation remain explicit corpus expansion work under DAY-293; no complete
curriculum coverage is claimed.

Run a small paid comparison explicitly:

```sh
pnpm ai:eval --live --models baseline,flash-lite-3.5 --operation answer_evaluation --limit 4 --repeat 3 --max-calls 24 --max-usd 1
```

Set Vertex credentials in the **local CLI environment**, not public Expo envs.
Project auth uses `GOOGLE_VERTEX_PROJECT` plus application-default credentials;
Express Mode uses `GOOGLE_VERTEX_API_KEY`. Existing `.env.local` is not loaded
implicitly. Node can load a private file explicitly using
`node --env-file=<private-file> --import tsx scripts/ai-eval.ts ...`.

`ai/evals/models.json` is an explicit experiment configuration; it never changes
production defaults. Add any accessible OpenAI/Anthropic model by using provider
`openai`/`anthropic`, its exact API model ID, appropriate `providerOptions`, and
reviewed `prices`, `pricingSource` and `pricingReviewedAt`. Use `OPENAI_API_KEY`
or `ANTHROPIC_API_KEY`. Luna/Haiku candidates are configured when their actual
API IDs and access are verified; speculative IDs are not pinned. Separate
fixed-prompt and model-tuned configurations rather than silently tuning one side.

Every request has `maxRetries=0`, a token ceiling and a 60-second timeout.
Repetitions measure variability; failure attempts remain in reports. `max-calls`
is checked before the run and each request. `max-usd` stops **subsequent** calls
once observed spend reaches the threshold; a current request can exceed it and
unknown usage stops the rest of the run. This is not a provider-enforced dollar
cap. Reports checkpoint after every result under ignored
`.maestro/artifacts/ai-evals`, including errors, usage and unknown costs.

For Langfuse experiment comparison, use **separate evaluation project keys**,
`LANGFUSE_TRACING_ENVIRONMENT=evaluation`, and add `--publish`. Only this explicit
synthetic experiment path allows dataset prompts/outputs to reach the platform.
It publishes experiment items, automatic scores and per-attempt usage/cost traces.
Local corpora still send data to Langfuse when publication is enabled.

Each report pins the corpus/expanded-case hash, shared-contract hash, candidate
model/settings/prices, repetition, split and timestamps. Compare per operation;
do not use one averaged score to select a model for every task. Automatic checks
cover schema shape, grading labels, MCQ flags/distractor uniqueness and diagnostic
references. Factual correctness, grounding, semantic MCQ ambiguity, answerability
and teaching quality require the rubric-based review below. There is no uncalibrated
LLM judge making release decisions.

## Review and promotion

```sh
pnpm ai:eval:review --report .maestro/artifacts/ai-evals/<run>.json
```

This writes a shuffled, provider-blinded `.review.json` with source prompts,
rubrics and outputs. Keep the source report from the reviewer. Fill in reviewer,
UTC date, each boolean criterion and comments; preserve all IDs and the report
hash. Automatic pass flags are not proof that an answer is factually correct.
Use Langfuse's experiment comparison/annotation UI for collaborative review too.

After reviewing the **corpus itself**, record its reviewer/date and mark it
`reviewed`; that creates a new dataset hash. Run the complete held-out split
with adequate explicit call/spend limits, review its outputs, then check:

```sh
pnpm ai:eval:review --report <report> --reviews <report>.review.json --check
```

The conservative initial gate requires a reviewed corpus, complete held-out run,
known costs, passing automatic scores and passing human criteria for every output.
It reports cost per human-accepted output, including the spend on rejected outputs.
Creating a review template never overwrites an existing review file.
It does not change production models. Record the comparison and approved rollout
in the canonical Notion strategy before changing routing. CI runs the deterministic
corpus/scoring/privacy tests through the normal unit suite; paid evaluations are
explicit workflows, never automatic on every pull request.

To improve the corpus: categorize a real failure, reconstruct a synthetic case
with the same failure mechanism, review its reference/rubric, then add it to the
development source pack and version it. Preserve the held-out material for final
comparisons. Real learner data requires separate approval and retention rules.
