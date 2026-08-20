# Convex egress and recovery runbook

This runbook is the implementation-facing operating record for
[DAY-280](https://linear.app/dayova/issue/DAY-280) and its direct child issues.
Product cost decisions remain in the Notion
[product cost model](https://www.notion.so/3b22e87228bf8165a27de0b4dc1bbb9b).

## Incident attribution

The original 26 July screenshot was an incomplete, all-project view showing
819.91 MB of data egress and 186.2 MB of file storage. The finalized July view
was inspected per project and function on 20 August 2026:

| Scope | July 2026 data egress | Attribution |
| --- | ---: | --- |
| Convex team | 1.07 GB | All projects |
| `dayova-mvp` | 610.09 MB | Project total |
| `dayova-mvp` development learning-plan actions | 595.88 MB | 97.7% of the project total |
| `dayova-mvp` production learning-plan actions | about 14.04 MB | Small production/tester share |
| Legacy `smartnotes` | 482.9 MB | PostHog outbox, separate project and codebase |

The top `dayova-mvp` development action groups were:

| Function | July egress |
| --- | ---: |
| `learningPlanAi.generatePlan` | 295.03 MB |
| `learningPlanAi.generateKnowledgeQuestions` | 192.20 MB |
| `learningPlanAi.ensureSessionContent` | 74.37 MB |
| `learningPlanAi.retryFailedSessionContent` | 34.28 MB |

The four groups sum to 595.88 MB. This matches the repeated raw-material
forwarding path and rules out backups as the dominant July cause. The dashboard
did not expose a historical per-subscription byte total, so the July reactive
query share cannot be reconstructed exactly; it is bounded as a secondary
source rather than included in the 595.88 MB action total.

For 1–20 August 2026, the team had used 851.12 MB of its 1 GB allowance and
`dayova-mvp` accounted for 580.38 MB. The separate legacy `smartnotes` PostHog
outbox accounted for 270.74 MB and needs its own repository/work item.

Both `dayova-mvp` development (`resilient-pika-316`) and production
(`sleek-bulldog-130`) use Cloudflare R2 through `FILE_STORAGE_PROVIDER=r2`.
Neither deployment had a stored or periodic Convex backup when inspected on
20 August 2026. No July backup/export entry was present, so its observed
contribution is 0 B; Convex does not provide a longer historical audit trail
from which deleted/expired manual backups could be disproved.

## Fixed material path

1. Upload registration enforces one shared contract: at most 10 files, 7 MiB
   per file and 35 MiB in total.
2. The server finalizes the upload, uses authoritative stored bytes, then checks
   the plan total inside the document-insert transaction. Racing uploads cannot
   both cross the boundary.
3. Processing version 2 claims each document once, downloads the source once,
   extracts locally where possible, and uses a single vision request only when
   a PDF/image needs it.
4. Normalized text is stored as stable, provenance-bearing chunks. The large
   temporary normalized-text field is cleared after chunk insertion.
5. Diagnostic, plan, session-batch, add-session and retry requests query a
   bounded relevant chunk set. They never attach an original source file.
6. Source text is delimited as untrusted evidence and followed by an explicit
   task reminder. Uploaded prompt instructions are not executable instructions.
7. Deleting a document deletes its managed source object immediately, then
   removes its context and chunks in bounded 40-row transactions. Plan deletion,
   context replacement and telemetry cleanup use the same bounded-continuation
   rule instead of loading a maximum-size context into one mutation.

Existing plans are grandfathered for reading and deletion. A plan already over
a new upload limit is not broken, but no additional document can be registered
until it is below both the count and aggregate-byte limit. Existing version-1
contexts are lazily reprocessed on their next intentional use; the schema stays
widened for legacy rows during that transition.

## Deterministic egress regression

`convex/learningPlanEgressRegression.test.ts` writes the same durable ingestion,
transfer and model-request telemetry as the production path, then compares the
former repeated raw transport (`source bytes × model requests`) with measured
one-time source reads/raw extraction parts plus bounded selected context. These
are transport-byte measurements, not Vertex token-cost estimates.

| Fixture | Source | Requests | Selected context/request | Before | After | Reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Normal plan | 6 MiB | 8 | 64 KiB | 48 MiB | 6.50 MiB | 86.46% |
| Multimodal plan | 18 MiB | 12 | 70 KiB | 216 MiB | 36.82 MiB | 82.95% |
| Structured retry | 6 MiB | 11 | 64 KiB | 66 MiB | 6.69 MiB | 89.87% |

The multimodal fixture intentionally includes both the one-time 18 MiB source
read and the one-time 18 MiB raw vision-extraction part. Retries add compact
context only; they do not add another source read or raw part.
Regression tests also cover stable chunking, relevant content late in a source,
one-worker claims, processed-context reuse, every recurring action path, and the
static rule that rejects raw file parts outside the one-time vision extractor.
An additional instrumented-transport suite executes the production ingestion,
diagnostic, plan, session, add-session and failed-session-retry actions against
a fake source and fake model. It proves that all downstream generations still
produce one source read, exercises a structured model retry, verifies that the
vision path counts its one raw part/request, and confirms that a failed vision
request retains the source/raw byte counts that were already transported.

Quality is protected separately: the existing generated-content suites still
exercise text, Office, PDF/image media types, first-session diagnostics, theory,
practice, praxis, retry and source-authority behavior. This change does not
lower session counts, model choice, learning objectives or structured-output
validation to obtain the transport reduction.

### Live development verification

On 20 August 2026, a synthetic 483-byte text document was uploaded through the
real development R2 registration path. Processing reached `ready` and the
persisted ingestion diagnostic recorded exactly one source document, 483 source
bytes, one source-file read, zero raw file parts and zero model requests. An
explicit processing retry returned `ready`; the diagnostic remained one
successful ingestion attempt with `sourceFileReadCount = 1`. This is direct
post-deploy evidence that an already processed document is reused rather than
downloaded again. The synthetic plan and managed object were removed after the
aggregate evidence was recorded.

## Reactive query measurements

The deterministic DAY-287 plan fixture serialized the old broad generation
snapshot at 1,754 bytes and the isolated progress result at 151 bytes, a 91.39%
payload reduction. A static plan-metadata write now produces zero progress-query
result change and does not touch the progress row; a progress write affects the
small progress query only.

The deterministic session fixture serialized the old combined content result
at 6,663 bytes. Its changing progress portion is 31 bytes; answer/progress writes
therefore no longer resend the 6,633-byte static content portion. The app uses
separate static-content and progress subscriptions.

Notification synchronization uses the compound owner/date indexes for only the
requested date keys instead of reading up to 200 sessions and filtering them in
memory. All new plan, document, answer, session and progress queries require an
authenticated owner, use explicit validators/IDs, and keep bounded results.

## Attempt diagnostics

Each diagnostic, plan, session-content and retry attempt has a durable UUID,
dedupe key, deployment environment and final state. Inspect
`learningPlanAiTransfers.getMyDiagnostics` as the signed-in learner/test owner.
The result contains:

- source document count/bytes, processing version and source-read count;
- reused-document count and duplicate-start count;
- raw file-part count/bytes (non-zero only on one-time multimodal ingestion);
- selected chunk count/bytes and final compact context bytes;
- model-request count, structured retry count and session-batch count;
- provider context/cache mode, completion state and privacy-safe error code.

Lazy ingestion receives its own child attempt because it has a distinct
operation and completion state, but stores both `parentAttemptId` and
`documentId`. The parent must exist for the same plan. This connects the source
read/extraction request to the generation attempt whose later model calls,
batches, structured retries and completion all retain the parent attempt ID.
Generation rows always report zero source-file reads; a lazy physical read is
counted once on the linked ingestion child, never on both rows. Failed ingestion
also records bytes read and raw parts submitted before the failure.

A model-request row is written before each tracked provider call, so failed
requests are counted. Development and production are separable through
`DAYOVA_DEPLOYMENT_ENVIRONMENT`. Never log filenames, document text, provider
payloads or learner answers in egress or upload-rejection telemetry.

If a non-ingestion attempt has `rawFilePartCount > 0`, an ingestion attempt has
`sourceFileReadCount > sourceDocumentCount`, a duplicate active attempt starts
provider work, or selected context exceeds 70,000 characters, stop the rollout
and investigate before generating more plans. Delete flows remove diagnostics
with bounded scheduled continuations.

## Upload-limit operations

The 10-file / 7-MiB / 35-MiB limits bound a single plan below the former backend
20-document read and below an unbounded multi-file source amplification. The
35-MiB total still permits five maximum-size files or ten representative mixed
files. The UI shows used/remaining count and bytes before upload; the server is
authoritative after upload finalization.

Privacy-safe rejection telemetry records only a reason, media type, size
bucket, plan aggregate count/bytes and timestamp. A rejected finalized object
is deleted. Exact-boundary, over-boundary, concurrent and cleanup paths are
covered by tests.

## Backup, export and restore policy

Convex backups contain table data and can include file storage, but do not
contain deployed code, environment variables or pending scheduled functions.
Manual backups expire after seven days; daily/weekly periodic backups require a
Professional plan. Free/Starter deployments may retain at most two backups.
Generating or restoring a file-inclusive backup consumes file bandwidth. See
the official [Backup & Restore documentation](https://docs.convex.dev/database/backup-restore).

| Deployment | Owner | Purpose | Schedule while on Free | File storage | Retention |
| --- | --- | --- | --- | --- | --- |
| Development | Fabius Schurig | Disposable test data | None | Excluded | No backups |
| Production, before external users | Fabius Schurig | Pre-migration rollback | Manual before a destructive migration or risky data release | Include only when source files are affected | Convex seven-day window; delete superseded copies |
| Production, once external user data is relied on | Fabius Schurig | User-data recovery | Upgrade to Professional and enable weekly full backups; revisit daily when the accepted RPO is below seven days | Included | Weekly backups: 14 days |

Jakob owns the product/cost decision; Fabius owns the technical control and
restore execution. Before launch, the accepted recovery objective is RPO seven
days and RTO one business day. The Free plan cannot guarantee that RPO through
automation; launch readiness therefore requires either the Professional backup
upgrade or an explicitly approved external export control. Do not silently add
recurring file-inclusive exports to work around the plan, because they consume
the same constrained egress and create another sensitive-data store.

Before a manual production backup, estimate file egress as:

`current table export bytes + included managed-file bytes`

Record the timestamp, scope, estimated bytes, reason and owner on DAY-286. Do
not take file-inclusive development backups. Inventory R2 objects through the
managed-file component and learning-plan document rows; do not delete
unreferenced objects during an audit. Open a separate recoverable cleanup issue
with a dry-run inventory first.

Restore procedure:

1. Pause writes and record the incident window.
2. Create a final pre-restore backup if the deployment is readable.
3. Select a known-good backup from the same team and verify whether it contains
   file storage.
4. Restore it through the dashboard. Restore is destructive for table data;
   existing files are not deleted automatically.
5. Redeploy known-good code and restore environment variables separately.
6. Verify authentication, plan/document ownership, managed-file reads, one
   learning-plan query and one non-mutating document-context query.
7. Record achieved RPO/RTO and any orphan-file reconciliation follow-up.

## Validation and evidence checklist

- `npx convex dev --once` succeeds against development.
- TypeScript, lint, Vitest and rendered Jest interaction tests are green.
- Run the normal, multimodal and retry fixtures before release.
- Inspect diagnostics for zero recurring raw parts and at most one intentional
  source read per processing version.
- Compare the post-deploy function dashboard with the July action baseline.
- Attach expanded July/current usage, backup settings, and before/after app-flow
  screenshots and recordings to PR #496 and the relevant Linear issues.
- Do not move DAY-281, DAY-286 or the DAY-280 parent to In Review without the
  required visual dashboard evidence and an approved production backup control.
