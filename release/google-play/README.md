# Google Play launch command center

Last audited: 2026-08-26

This directory is the evidence and handoff pack for the first Dayova Google
Play release. The production release has now been submitted; use this pack to
monitor review, finish the remaining commercial/privacy work, and record public
availability.

## Current verdict

**Production state live-verified 2026-08-26: submitted and still in Google
review since 2026-08-23, but the candidate must be replaced.** Android SDK 57
build `1.0.3` (version code `20`) uses runtime `1.0.3`, while DAY-248 requires
the new SDK 57 native boundary at runtime `1.0.4`. Managed publishing is off, so
approval could publish automatically. Production OTA remains fail-closed and
build 20 must never become the verified OTA baseline.

| Area | Current evidence | Remaining completion |
| --- | --- | --- |
| Play account and app | Verified Organization account, developer account ID `4912315867079102345`, app ID `4976075040375716512`, package `com.dayova`, production track ID `4697718440238285251`. The Dayova Organization payments profile is reachable by the release operator as Payments Center admin and primary contact; Payments Center showed no alerts on 2026-08-23. | Julius, as the original Play account owner, must still open Play Console's owner-only Payments profile page and confirm or resolve its previously reported “Action required with your payments account” item. Payments Center admin access does not grant access to that Play-only page. The item did not block review submission. |
| Production submission | EAS build `1b52de89-746d-4600-9670-7c395079ff02`, SDK 57, app/runtime `1.0.3`, version code `20`, fingerprint `bbcbaae5c8ae69231aa15692d7197e4e87f61cac`, source `31f7f25787d2c4cdfde96384379f47b3e321fc17`, submission `d3e7d523-cac4-4be9-a55c-2245d1095972`; release `1.0.3 – Erste Play-Store-Version` is in review. | Withdraw and replace with a clean SDK 57 app/runtime `1.0.4` build. EAS remote version code is `20`, so the replacement is expected to auto-increment to `21`; verify the actual build metadata before submission. Never record build 20 as the OTA baseline. |
| Test distribution | The repo now has explicit EAS Submit profiles for Internal, Closed (`alpha`), Open (`beta`), and draft Production plus a manual checked/approved EAS Workflow for new Closed/Open candidates. Play Console contains prepared but deliberately unsubmitted Closed/Open changes for `1.0.3` / version code `20`; the Closed audience uses the existing Dayova internal list and both tracks target Germany. | Do not submit the four pending Closed/Open changes while Production review is active. After that review resolves, revalidate feedback, audience, country/cap, service-account permissions, and version-code precedence before submitting and running install QA. |
| Listing and declarations | German listing, icon, feature graphic, eight current phone screenshots, Education category, Germany targeting, 13+ audience, content rating, privacy URL, Data safety, Ads, Health, Government, Financial features, App access, and review notes are in review. | Treat accepted declarations as review input, not proof that the open privacy/deletion implementation is complete. |
| Reviewer access | Dedicated synthetic Clerk account has permanent RevenueCat `dayova_full_access`; Play instructions require no trial, purchase, OTP, 2FA, or special device. | Keep the account valid and synthetic until review is complete. Credentials stay only in Play Console. |
| RevenueCat and billing | RevenueCat project `413fab77` is connected; production EAS has Android and iOS public SDK keys; production Convex has the server key. Old/exposed temporary keys were rotated or revoked. | Before the first 14-day trials expire, finish/verify the Play monthly and annual base plans, RevenueCat product linkage, and Play-signed purchase/restore/lifecycle QA under DAY-218. |
| App privacy and account deletion | Play accepted the submitted privacy/Data safety/deletion declarations into review, but the live policy remains website-specific and the end-to-end deletion implementation is not verified. | Keep DAY-217/DAY-357/DAY-359/DAY-361 and DAY-183/DAY-358/DAY-360/DAY-362/DAY-363 open until implemented and verified. |

## Fastest path from review to a usable launch

1. **Keep test tracks untouched while Production review is active.** The four
   Closed/Open changes remain under **Changes not yet submitted for review**.
   Do not submit, rebuild, promote, or remove them until the Production review
   is withdrawn or otherwise resolves. Build 20's runtime collision is a real
   release blocker, so coordinate withdrawal and replacement rather than
   accepting it as the DAY-248 candidate.
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
5. **Verify the replacement, not build 20.** Distribute and install the exact
   app/runtime `1.0.4` artifact, promote that same version code to Production,
   verify the public German listing, and only then atomically replace
   `release/production-ota-baseline.json` with both verified platforms.
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

The original production review submission is complete but is no longer the safe
release candidate. Withdrawing it, discarding the obsolete testing drafts after
review ends, and submitting the replacement are separate external release
actions that require release-owner confirmation. This pack does not claim Google
approval, public availability, Play product activation, legal approval, or
privacy/deletion implementation until their dedicated evidence exists.
