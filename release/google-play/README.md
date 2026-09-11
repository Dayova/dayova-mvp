# Google Play launch command center

Last reconciled: 2026-09-11, using the submission evidence recorded on 2026-09-07
in [PR #545](https://github.com/Dayova/dayova-mvp/pull/545). This is not a new
live Console audit.

This directory is the evidence and handoff pack for the first Dayova Google
Play release. The production release has now been submitted; use this pack to
monitor review, finish the remaining commercial/privacy work, and record public
availability.

## Current verdict

**Current recorded candidate: app/runtime 1.0.5, version code 23, submitted on
2026-09-07.** Internal testing availability was confirmed. Production, Open
testing, and Closed Alpha rollouts plus resuming Open testing were sent for
review. Managed publishing was off, so approval can publish automatically.
Public availability and Play install/billing QA remain unverified in this
handoff. Recheck Console for changes since that evidence before acting.

| Area | Current evidence | Remaining completion |
| --- | --- | --- |
| Play account and app | Verified Organization account, developer account ID `4912315867079102345`, app ID `4976075040375716512`, package `com.dayova`, production track ID `4697718440238285251`. The Dayova Organization payments profile is reachable by the release operator as Payments Center admin and primary contact; Payments Center showed no alerts on 2026-08-23. | Julius, as the original Play account owner, must still open Play Console's owner-only Payments profile page and confirm or resolve its previously reported “Action required with your payments account” item. Payments Center admin access does not grant access to that Play-only page. The item did not block review submission. |
| Production submission | App/runtime `1.0.5`, version code `23`, uploaded through EAS submission `74999aaa-d7a9-4cda-b83a-e97e965066b7` on 2026-09-07. The Production `1.0.4`/code-21 draft was replaced; Production, Open testing, and Closed Alpha full rollouts plus resuming Open testing were sent for review. | Monitor review and verify public availability. Do not repeat submission or resume obsolete build-20/21 instructions. |
| Submitted artifact | EAS build `b8c2cdc4-076f-4569-90e2-6135fdb4bbe8`, app/runtime `1.0.5`, version code `23`, source `f1aff0f53708ca45b884100a8693a0209b983e2a`. The [candidate audit](./release-candidate-audit.md) records its exact AAB hash, fingerprint, and embedded update. | Install and verify this exact store-distributed build. Builds 20 and 21 are historical evidence only. |
| Test distribution | Internal testing availability of `1.0.5`/code `23` was confirmed on 2026-09-07. The same bundle was promoted to Closed Alpha and Open testing; all three submitted rollouts were 100%, preserving Germany targeting. | Recheck track/review state and tester eligibility, then run install QA on build 23 using the [testing runbook](./testing-tracks.md). |
| Listing and declarations | German listing, icon, feature graphic, eight current phone screenshots, Education category, Germany targeting, 13+ audience, content rating, privacy URL, Data safety, Ads, Health, Government, Financial features, App access, and review notes are in review. | Treat accepted declarations as review input, not proof that the open privacy/deletion implementation is complete. |
| Reviewer access | Dedicated synthetic Clerk account has permanent RevenueCat `dayova_full_access`; Play instructions require no trial, purchase, OTP, 2FA, or special device. | Keep the account valid and synthetic until review is complete. Credentials stay only in Play Console. |
| RevenueCat and billing | RevenueCat project `413fab77` is connected; production EAS has Android and iOS public SDK keys; production Convex has the server key. Old/exposed temporary keys were rotated or revoked. | Before the first 14-day trials expire, finish/verify the Play monthly and annual base plans, RevenueCat product linkage, and Play-signed purchase/restore/lifecycle QA under DAY-218. |
| App privacy and account deletion | Play accepted the submitted privacy/Data safety/deletion declarations into review, but the live policy remains website-specific and the end-to-end deletion implementation is not verified. | Keep DAY-217/DAY-357/DAY-359/DAY-361 and DAY-183/DAY-358/DAY-360/DAY-362/DAY-363 open until implemented and verified. |

## Fastest path from review to a usable launch

1. **Monitor the submitted build 23.** Recheck the Production, Closed Alpha,
   and Open testing review state and record any approval/public availability.
   The September 7 submission is complete; do not submit another AAB or resume
   the obsolete build-20/21 withdrawal and replacement sequence.
2. **Resolve the Play-owner notification.** Payments Center access is verified
   for the release operator, but Google reserves Play Console's Payments profile
   page for the original developer-account owner. Julius opens that page and
   confirms or resolves the previously reported action.
3. **Finish monetization before conversion.** Verify the approved monthly and
   annual Play products/base plans, their RevenueCat linkage, and purchase,
   restore, renewal, expiry, refund, and revocation on a Play-signed build before
   the first 14-day trials end.
4. **Finish privacy and deletion.** The submitted forms do not close DAY-217 or
   DAY-183 and their child tasks. Publish the app-specific policy and deletion
   resource, implement the secure deletion pipeline/settings flow, and run
   DAY-363 on the Play-delivered build.
5. **Verify the submitted candidate.** Install the exact app/runtime `1.0.5`,
   version-code-`23` artifact from Play and verify the public German listing
   once available. Keep `release/production-ota-baseline.json` unchanged until
   both platforms meet the [baseline requirements](../README.md).
6. **Start the promotion clock from real users, not review.** PRICING-002's
   roughly day 8–10 email is anchored to public availability / authoritative
   trial start and must still expire no later than the 14-day trial.

## Release ownership

| Workstream | Suggested owner | Tracker |
| --- | --- | --- |
| Play account and review | Jakob / Play and Payments Center admin | DAY-218 / DAY-325 |
| Owner-only Play Payments profile page | Julius / original account owner | DAY-218 / DAY-325 |
| App privacy, target ages, retention | Product + legal | DAY-217 |
| Account deletion implementation | App/backend | DAY-183 |
| Play products and RevenueCat Android verification | Billing owner | DAY-218 (DAY-228 implementation is Done) |
| Review monitoring, launch verification, OTA baseline | Release operator | DAY-218 / DAY-248 |

## Prepared files

- [`store-listing-de-DE.md`](./store-listing-de-DE.md): paste-ready German store
  listing and release notes.
- [`play-console-checklist.md`](./play-console-checklist.md): ordered Console
  form checklist and current answer draft.
- [`data-safety-draft.md`](./data-safety-draft.md): conservative code-based data
  inventory. It is a draft, not a legal declaration.
- [`release-candidate-audit.md`](./release-candidate-audit.md): exact EAS/build
  provenance and version recommendation.
- [`testing-tracks.md`](./testing-tracks.md): Closed/Open track contract,
  automated release workflow, tester eligibility, and one-time Console setup.
- [`assets/README.md`](./assets/README.md): artwork validation and screenshot
  shot list.
- [`official-sources.md`](./official-sources.md): current primary documentation
  used for this audit.

## Human-confirmation boundary

The September 7 submission and promotions are recorded as complete. Any new
withdrawal, replacement, or rollout action requires release-owner confirmation
and a fresh Console check. This pack does not claim Google approval, public
availability, Play product activation, legal approval, or privacy/deletion
implementation until their dedicated evidence exists.
