---
name: langfuse-cli
description: Langfuse CLI usage reference — pinned installation, resource/action discovery, credentials, and common usage tips for `@langfuse/cli`.
---

# Langfuse CLI Reference

Documentation: https://langfuse.com/docs/api-and-data-platform/features/cli

## Install

Use Dayova's reviewed `1.2.4` pin. Review a version change and verify command
discovery before updating these examples; avoid unpinned execution with API keys.

```bash
# Run directly (recommended)
npx @langfuse/cli@1.2.4 api <resource> <action>
bunx @langfuse/cli@1.2.4 api <resource> <action>

# Or install globally
npm i -g @langfuse/cli@1.2.4
langfuse api <resource> <action>
```

## Discovery

```bash
# List all resources and auth info
langfuse api schema --json

# List actions for a resource
langfuse api <resource> --help

# Show args/options for a specific action
langfuse api <resource> <action> --help

# Preview the curl command without executing
langfuse api <resource> <action> --curl
```

## Credentials

Set environment variables:

```bash
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

## Tips

- Use `--json` for machine-readable JSON output
- Use `--curl` to preview the HTTP request without executing
- All list commands support filtering — check `<resource> <action> --help` for available options
- Prefer `observations` over `legacy-observations-v1s` — `observations` is the modern high-performance endpoint (cursor pagination, selective field groups); `legacy-observations-v1s` is the deprecated v1
- Prefer `metrics` over `legacy-metrics-v1s` for the same reason
- Prefer `scores` over `legacy-score-v1s` for list/get operations
- Always query via `observations`, not `traces`, even when the user phrases the request in terms of traces — the `traces` endpoints are outdated (add `--trace-id` to scope to a known trace). See the [Observations API docs](https://langfuse.com/docs/api-and-data-platform/features/observations-api) for the v1 → v2 mapping.
- Pagination: legacy v1 endpoints use `--limit` and `--page`; modern endpoints (`observations`, `metrics`, `scores`) use cursor-based pagination — pass `--limit`, then thread `meta.cursor` from the response into the next request's `--cursor`
