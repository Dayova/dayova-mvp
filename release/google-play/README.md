# Google Play launch command center

Last reconciled: 2026-09-16 using signed-in Play Console, App Store Connect,
RevenueCat, EAS, and public listing/policy checks. See the
[live verification report](../live-verification-2026-09-16.md) for evidence and
limits. This does not include installed-device QA.

This directory is the evidence and handoff pack for the first Dayova Google
Play release. Google availability is independently confirmed; use this pack to
verify the installed build and finish the remaining commercial/privacy evidence.

## Current verdict

**Current recorded Android release: app/runtime 1.0.5, version code 23.** EAS
metadata matches the [candidate audit](./release-candidate-audit.md). Production,
Internal, Closed Alpha, and Open testing all show 1.0.5/code 23 available.
There are no unpublished changes. Play install/billing QA remains unverified.
Do not repeat the completed submission.

**Priority corrections:** the saved Google Data safety answer incorrectly says
no data is collected, and Apple's configured privacy/support URLs return 404.
These were verified without changing the live declarations or website.

| Area | Current evidence | Remaining completion |
| --- | --- | --- |
| Play account and app | Verified Organization account, developer account ID `4912315867079102345`, app ID `4976075040375716512`, package `com.dayova`, production track ID `4697718440238285251`. The Dayova Organization payments profile is reachable by the release operator as Payments Center admin and primary contact; Payments Center showed no alerts on 2026-08-23. | Julius, as the original Play account owner, must still open Play Console's owner-only Payments profile page and confirm or resolve its previously reported “Action required with your payments account” item. Payments Center admin access does not grant access to that Play-only page. The item did not block review submission. |
| Production distribution | App/runtime `1.0.5`, version code `23`, uploaded through EAS submission `74999aaa-d7a9-4cda-b83a-e97e965066b7` on September 7. Console and the German public listing confirm availability; Production targets Germany. | Verify the exact installed version. Do not repeat submission or resume obsolete build-20/21 instructions. |
| Submitted artifact | EAS build `b8c2cdc4-076f-4569-90e2-6135fdb4bbe8`, app/runtime `1.0.5`, version code `23`, source `f1aff0f53708ca45b884100a8693a0209b983e2a`. The [candidate audit](./release-candidate-audit.md) records its exact AAB hash, fingerprint, and embedded update. | Install and verify this exact store-distributed build. Builds 20 and 21 are historical evidence only. |
| Test distribution | Internal, Closed Alpha, and Open testing all show `1.0.5`/code `23` available on September 16. | Verify tester-specific eligibility and run install QA using the [testing runbook](./testing-tracks.md). |
| Listing and declarations | German listing copy matches; support email is `kontakt@dayova.de`. Console has ten actioned declarations and targets ages 13–15, 16–17, and 18+. Saved Data safety incorrectly selects no collection/sharing. | Correct Data safety using the [inventory](./data-safety-draft.md). Actioned forms do not prove privacy/deletion implementation is complete. |
| Reviewer access | Dedicated synthetic Clerk account has permanent RevenueCat `dayova_full_access`; Play instructions require no trial, purchase, OTP, 2FA, or special device. | Keep the account valid and synthetic until review is complete. Credentials stay only in Play Console. |
| RevenueCat and billing | Both Play base plans are active for Germany and mapped to the default RevenueCat offering and `dayova_full_access`. Apple products are Approved; its German annual price is €155.99. The Play listing shows €14.99–€155.88, but its per-product price table failed to load. | Verify exact Play prices and Play-signed purchase/restore/lifecycle behavior. Configuration is not transaction QA. |
| App privacy and account deletion | The live [policy](https://dayova.com/privacy), checked September 16, covers the mobile app, Vertex AI, R2, analytics, and subscriptions. Android billing, GeoIP, permission descriptions, and implementation evidence still need reconciliation; see the [Data safety draft](./data-safety-draft.md). End-to-end deletion is not verified. | Keep DAY-217/DAY-357/DAY-359/DAY-361 and DAY-183/DAY-358/DAY-360/DAY-362/DAY-363 open until their criteria are met; include DAY-216 for GeoIP. |

## Remaining release verification

1. **Verify installed build 23.** Console availability is confirmed for all four
   tracks; record the exact version delivered to a device.
   The September 7 submission is complete; do not submit another AAB or resume
   the obsolete build-20/21 withdrawal and replacement sequence.
2. **Resolve the Play-owner notification.** Payments Center access is verified
   for the release operator, but Google reserves Play Console's Payments profile
   page for the original developer-account owner. Julius opens that page and
   confirms or resolves the previously reported action.
3. **Finish monetization verification.** Product activation and RevenueCat
   linkage are confirmed. Verify exact Play prices and purchase, restore,
   renewal, expiry, refund, and revocation on a Play-signed build.
4. **Correct privacy declarations and links, then verify deletion.** Replace the
   incorrect Google no-collection declaration and repair Apple's configured
   `/app/privacy` and `/app/support` URLs. These findings do not close DAY-217 or
   DAY-183 and their child tasks. Reconcile the published app policy, verify the
   deletion resource, implement the secure deletion pipeline/settings flow, and run
   DAY-363 on the Play-delivered build.
5. **Preserve the OTA gate.** Store availability is confirmed, but installation
   and runtime verification remain outstanding. Keep `release/production-ota-baseline.json` unchanged until
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

DAY-218 and DAY-325 are marked Done in Linear; their links above preserve
historical ownership, not proof that every old checklist item was completed.
Record current native/OTA release evidence under DAY-248 and workflow work under
DAY-414. Before acting on a remaining account or billing item, reconcile its
evidence and active ownership in Linear rather than treating these completed
parent tasks as an active queue. DAY-228's completed app implementation likewise
does not certify external product configuration or Play-signed billing QA.

## Prepared files

- [`live-verification-2026-09-16.md`](../live-verification-2026-09-16.md): live
  distribution, billing, declaration, policy, and asset findings with limits.
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
- [`official-sources.md`](./official-sources.md): dated primary references and
  the subset rechecked during this reconciliation.

## Human-confirmation boundary

The September 7 submission and promotions are complete, and current store
availability and subscription activation are independently verified. Any new
withdrawal, replacement, or rollout action requires release-owner confirmation
and a fresh Console check. This reconciliation does not certify installation,
billing transactions, legal approval, or privacy/deletion implementation.
