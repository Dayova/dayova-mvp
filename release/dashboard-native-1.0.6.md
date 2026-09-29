# Dashboard native candidate — 1.0.6

This is release preparation, not a merge, distribution or production OTA approval.
The candidate is a separate child of [dashboard PR #797](https://github.com/Dayova/dayova-mvp/pull/797),
starting at `78e5eaf2fd6b2edfc17f7cbc3b0698e820b51839`.
It preserves the dashboard and all inherited features. The parent PR and its
unmerged dependencies still need review in dependency order.

## Why an existing-binary OTA cannot deliver this source

The [non-publishing preflight](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a0edcb-d935-75a3-b662-eb49b72951a9)
on that parent found iOS fingerprint `9580bd11061937728d45fa464bacae9e329f6bf1`
and Android fingerprint `1f8558d490d21885c5f74d51913698c06b483b55`.
Neither matches the verified iOS 75 / Android 25 baseline. The candidate includes
real native changes, not only fingerprint bookkeeping: photo preparation imports
`expo-image-manipulator`, which is absent from the baseline dependency set.

This change assigns app/runtime 1.0.6 to both platforms. The existing 1.0.5
baseline, its immutable fingerprints and all production safety gates stay intact.
Regression coverage requires matching platform runtimes and rejects this source
against the old baseline even if the supplied fingerprints match the old builds.

## Build and verification sequence

1. Review this child and all parents; record the exact final source SHA. Use a
   clean checkout with `cli.requireCommit` enabled. No no-VCS upload or safety
   bypass is allowed.
2. Build signed candidates using the existing `production` profile for iOS and
   Android, without automatic submission. Record build IDs, source SHA, build
   numbers, app/runtime 1.0.6, embedded channel and native fingerprints.
3. Check the deployed backend contains the APIs required by the dashboard.
   No backend deployment is implied by building the app.
4. Distribute only with explicit release authorization. Verify the exact
   production-channel artifacts can be installed and launched on both physical
   platforms. A finished cloud build is not installation evidence.
5. Use dedicated `ota-staging` / `ota-staging-testflight` builds from the same
   source for the 1.0.6 update path. Verify a downloaded update actually runs after
   a cold restart and record the running UUID and emergency-launch state.
6. Only after both platforms pass, prepare a separately reviewed atomic baseline
   replacement with exact artifact evidence. Run the production CNG preflight
   and both exports on the final activation candidate. Unknown fingerprints must
   still fail closed. Follow [the release policy](./README.md) for activation.

## Outstanding evidence

- [ ] Signed iOS and Android 1.0.6 build provenance and artifact inspection.
- [ ] Backend compatibility with the final integrated source.
- [ ] Physical installation and staging OTA launch proof on both platforms.
- [ ] Light/Dark, large-text, empty-state, day-change and navigation QA.
- [ ] Four parent-relative PR evidence artifacts and Dayova product-quality review.
- [ ] Final baseline activation review, exports and fresh compatibility report.

The existing 1.0.5 release is not relabelled or invalidated by this preparation.
There is no new 1.0.6 distribution or OTA claim until the corresponding evidence
above exists.
