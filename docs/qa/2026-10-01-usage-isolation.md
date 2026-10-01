# Background AI usage: isolated review handoff

PR #748 is based on #661 at `b9035e9c158e6ba95342bccc5fc0c868494b1167`.
The real dependency is `assertAccountActive` and the account-deletion request
schema. #745 and the combined QA branch are not prerequisites for this fix.

The internal recorder derives ownership from the stored plan when no client
identity exists. A present foreign identity, a missing plan, or an account being
deleted is still rejected. No public endpoint or schema is added by this layer.

The original regression used `document_extraction`, introduced by separate #496.
This layer tests the same operation-independent recorder using the parent's
existing `plan` operation; all five original ownership/deletion cases remain.
It does not enable or certify #496's extraction pipeline or extended telemetry.
When integrating #496, preserve this ownership/deletion logic and run the
extraction-specific integration test against that combined code.

Current validation: 13 tests across usage and account deletion, TypeScript,
targeted ESLint/Biome and diff checks passed. Independent Standards/security
and Spec reviews found no blocking issues. No backend deployment, native replay,
OTA or paid build was performed. Ready for Review is not release approval.
