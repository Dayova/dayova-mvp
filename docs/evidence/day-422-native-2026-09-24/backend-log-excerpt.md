# Sanitized dev log excerpt — 2026-09-24

Deployment: trustworthy-skunk-257 (dev). Timestamps are Unix seconds. Only function/error/request metadata retained; no credentials or uploaded contents.

| Timestamp | Function | Error | Request |
| --- | --- | --- | --- |
| 1790250856.3358026 | learningPlans:registerUploadedDocument | null | 6716eaa05847568d |
| 1790250857.0060797 | learningPlans:registerUploadedDocument | null | 5a4f95288723129a |
| 1790250859.262381 | learningPlanAi:processUploadedDocument | Missing Vertex configuration (below) | ee97e942e460f2f1 |
| 1790250859.9612322 | learningPlanAi:processUploadedDocument | Missing Vertex configuration | 425f3ab06e48c988 |
| 1790251478.2629526 | learningPlans:registerUploadedDocument | null | 90166f2cf65ce5a5 |
| 1790251479.0947893 | learningPlanAi:processUploadedDocument | Missing Vertex configuration | 911088138c56eb0b |
| 1790251487.3603826 | learningPlans:registerUploadedDocument | null | 83490776f43efd0f |
| 1790251487.7910578 | learningPlanAi:processUploadedDocument | Missing Vertex configuration | fd811b67c8eb6d87 |
| 1790251499.8562982 | learningPlans:registerUploadedDocument | null | 70a7832df9d5b297 |
| 1790251500.9113986 | learningPlanAi:processUploadedDocument | Missing Vertex configuration | fb0876d47c93dd32 |
| 1790251743.467567 | learningPlans:registerUploadedDocument | null | 91cfe3d6bf926561 |
| 1790251744.5574157 | learningPlanAi:processUploadedDocument | Missing Vertex configuration | cbc64f69fefa75bc |

Exact error: `Uncaught Error: Konfiguriere GOOGLE_VERTEX_API_KEY oder GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION.`

Logs cover both gallery and PDF tests. They do not contain filenames, so this excerpt alone is not a per-file correlation proof; use it alongside the native recordings.
