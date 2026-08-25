# Google Play launch command center

Last audited: 2026-08-25

This directory is the evidence and handoff pack for the first Dayova Google
Play release. The production release has now been submitted; use this pack to
monitor review, finish the remaining commercial/privacy work, and record public
availability.

## Current verdict

**Submitted and in Google review.** Android `1.0.3` (version code `20`) was
submitted to the Production track for Germany. Managed publishing is off, so an
approval should publish automatically. Google Play's automated quick checks
passed; the missing R8/ProGuard deobfuscation mapping file is the only recorded
non-blocking warning.

| Area | Current evidence | Remaining completion |
| --- | --- | --- |
| Play account and app | Verified Organization account, developer account ID `4912315867079102345`, app ID `4976075040375716512`, package `com.dayova`, production track ID `4697718440238285251`. The Dayova Organization payments profile is reachable by the release operator as Payments Center admin and primary contact; Payments Center showed no alerts on 2026-08-23. | Julius, as the original Play account owner, must still open Play Console's owner-only Payments profile page and confirm or resolve its previously reported “Action required with your payments account” item. Payments Center admin access does not grant access to that Play-only page. The item did not block review submission. |
| Production submission | EAS build `1b52de89-746d-4600-9670-7c395079ff02`, source `31f7f25787d2c4cdfde96384379f47b3e321fc17`, submission `d3e7d523-cac4-4be9-a55c-2245d1095972`; release `1.0.3 – Erste Play-Store-Version` is in review. | Monitor review. On approval, verify public installability in Germany and record the production OTA baseline. |
| Test distribution | The repo now has explicit EAS Submit profiles for Internal, Closed (`alpha`), Open (`beta`), and draft Production plus a manual checked/approved EAS Workflow for new Closed/Open candidates. The 2026-08-24 meeting record reports the Internal test as live. | Configure and verify the Closed tester audience and Open country/cap settings in Play Console, then copy the Console opt-in links. Prefer promoting the exact accepted Closed artifact to Open. |
| Listing and declarations | German listing, icon, feature graphic, eight current phone screenshots, Education category, Germany targeting, 13+ audience, content rating, privacy URL, Data safety, Ads, Health, Government, Financial features, App access, and review notes are in review. | Treat accepted declarations as review input, not proof that the open privacy/deletion implementation is complete. |
| Reviewer access | Dedicated synthetic Clerk account has permanent RevenueCat `dayova_full_access`; Play instructions require no trial, purchase, OTP, 2FA, or special device. | Keep the account valid and synthetic until review is complete. Credentials stay only in Play Console. |
| RevenueCat and billing | RevenueCat project `413fab77` is connected; production EAS has Android and iOS public SDK keys; production Convex has the server key. Old/exposed temporary keys were rotated or revoked. | Before the first 14-day trials expire, finish/verify the Play monthly and annual base plans, RevenueCat product linkage, and Play-signed purchase/restore/lifecycle QA under DAY-218. |
| App privacy and account deletion | Play accepted the submitted privacy/Data safety/deletion declarations into review, but the live policy remains website-specific and the end-to-end deletion implementation is not verified. | Keep DAY-217/DAY-357/DAY-359/DAY-361 and DAY-183/DAY-358/DAY-360/DAY-362/DAY-363 open until implemented and verified. |

## Fastest path from review to a usable launch

1. **Do not restart review unnecessarily.** Monitor Publishing overview, Policy
   status, owner email, and review messages; change the release only for a real
   blocker or rejection.
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
5. **Verify launch immediately after approval.** Install from a non-team German
   account, record the public timestamp/version, and update
   `release/production-ota-baseline.json` before relying on production OTA.
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

The authorized account actions and production review submission are complete.
Payments Center administrator access is verified, but the separate owner-only
Play Payments profile action is not. This pack does not claim Google approval,
public availability, Play product activation, legal approval, or
privacy/deletion implementation until their dedicated evidence exists.
