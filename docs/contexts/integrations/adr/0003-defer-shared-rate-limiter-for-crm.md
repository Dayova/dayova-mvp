# Defer a shared Rate Limiter for the Notion CRM

Status: tested and not adopted (2026-09-25). Builds on the [Workpool](0001-keep-crm-dispatch-out-of-workpool.md) and [Workflow](0002-defer-workflow-for-crm-audit.md) evaluations for [DAY-366](https://linear.app/dayova/issue/DAY-366).

The production CRM has one active reconciliation action at a time under its Convex lease. That action creates one Notion client, which spaces requests by 400 ms and observes the provider's `Retry-After` header on retry-safe requests. I added direct tests of both behaviors: two paginated requests were at least 375 ms apart, and a safe request that received HTTP 429 with `Retry-After: 1` waited at least 950 ms before retrying. The complete CRM test suite remains the regression gate.

Notion currently documents a 180-request-per-minute per-connection budget for most plans and a separate workspace-wide budget. The 400 ms spacing permits at most about 150 requests per minute from this client, subject to request duration. A `@convex-dev/rate-limiter` token bucket would add a Convex mutation/reservation to every request but cannot account for traffic from other connections sharing the Notion workspace. It also would not remove response-based `Retry-After` handling. With one Dayova CRM worker and one Notion client, it does not yet simplify or strengthen this path enough to justify the extra component.

No Rate Limiter component was installed in this PR. If Dayova adds another concurrent Notion writer using the same connection, or observes sustained 429s despite the current pacing, introduce a shared budget across those writers and test simultaneous requests. Keep provider `Retry-After` handling, because workspace and endpoint limits can still apply.

References: [Notion request limits](https://developers.notion.com/reference/request-limits), [Convex Rate Limiter](https://github.com/get-convex/rate-limiter#readme).
