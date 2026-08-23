# Google Play launch command center

Last audited: 2026-08-23

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
| Play account and app | Verified Organization account, developer account ID `4912315867079102345`, app ID `4976075040375716512`, package `com.dayova`, production track ID `4697718440238285251`. | Julius resolves Play's owner-only “Action required with your payments account” notification. It did not block review submission. |
| Production submission | EAS build `1b52de89-746d-4600-9670-7c395079ff02`, source `31f7f25`, submission `d3e7d523-cac4-4be9-a55c-2245d1095972`; release `1.0.3 – Erste Play-Store-Version` is in review. | Monitor review. On approval, verify public installability in Germany and record the production OTA baseline. |
| Listing and declarations | German listing, icon, feature graphic, eight current phone screenshots, Education category, Germany targeting, 13+ audience, content rating, privacy URL, Data safety, Ads, Health, Government, Financial features, App access, and review notes are in review. | Treat accepted declarations as review input, not proof that the open privacy/deletion implementation is complete. |
| Reviewer access | Dedicated synthetic Clerk account has permanent RevenueCat `dayova_full_access`; Play instructions require no trial, purchase, OTP, 2FA, or special device. | Keep the account valid and synthetic until review is complete. Credentials stay only in Play Console. |
| RevenueCat and billing | RevenueCat project `413fab77` is connected; production EAS has Android and iOS public SDK keys; production Convex has the server key. Old/exposed temporary keys were rotated or revoked. | Before the first 14-day trials expire, finish/verify the Play monthly and annual base plans, RevenueCat product linkage, and Play-signed purchase/restore/lifecycle QA under DAY-218. |
| App privacy and account deletion | Play accepted the submitted privacy/Data safety/deletion declarations into review, but the live policy remains website-specific and the end-to-end deletion implementation is not verified. | Keep DAY-217/DAY-357/DAY-359/DAY-361 and DAY-183/DAY-358/DAY-360/DAY-362/DAY-363 open until implemented and verified. |

## Fastest path from review to a usable launch

1. **Do not restart review unnecessarily.** Monitor Publishing overview, Policy
   status, owner email, and review messages; change the release only for a real
   blocker or rejection.
2. **Resolve the payment-owner notification.** Julius completes the missing Play
   payments-profile information.
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
| Play account, review, and payments-profile owner action | Julius / account owner | DAY-218 / DAY-325 |
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
- [`assets/README.md`](./assets/README.md): artwork validation and screenshot
  shot list.
- [`official-sources.md`](./official-sources.md): current primary documentation
  used for this audit.

## Human-confirmation boundary

The authorized account actions and production review submission are complete.
This pack does not claim Google approval, public availability, payment-profile
completion, Play product activation, legal approval, or privacy/deletion
implementation until their dedicated evidence exists.
