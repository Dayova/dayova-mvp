# Play Console submission checklist

Last reconciled: 2026-09-16. The [live verification report](../live-verification-2026-09-16.md)
records fresh Console, public listing, and billing configuration checks.
Historical submission items retain the August audit and September 7 record in
[PR #545](https://github.com/Dayova/dayova-mvp/pull/545). Unchecked items mean
evidence is not recorded here, not necessarily that no one completed the work.

The current recorded candidate is app/runtime **1.0.5**, version code **23**.
Builds 15, 20, and 21 are historical artifacts; do not resume their old
withdrawal/replacement instructions.

## 1. Developer account

- [x] Sign in to the verified Dayova **organization** developer account.
- [ ] Reconcile the historical DAY-325 evidence set: account owner and developer ID
      are known; public developer name, fee receipt, and agreement/verification
      evidence still need one recorded source.
- [x] Invite the release operator with the minimum permissions needed to create
      and release `com.dayova`.
- [x] Verify that the release operator can open the Dayova Organization profile
      in Google Payments Center as **Admin, primary contact**. Payments Center
      showed no alerts on 2026-08-23.
- [ ] Have Julius open Play Console's owner-only Payments profile page and
      confirm or resolve the previously reported payments-account action.
- [x] Inspect the public developer email, address, and phone shown by Google
      on September 16. This records visibility, not owner attestation of accuracy.

Developer account ID: `4912315867079102345`. Jakob has Play account-level
**Admin (all permissions)** and Payments Center **Admin, primary contact**
access. Google nevertheless reserves the Play Console Payments profile page for
the original developer-account owner, so Julius must perform that final
Play-specific check.

## 2. Create the app

- [x] App name: **Dayova**
- [x] Default language: **German (Germany) — de-DE**
- [x] App or game: **App**
- [x] Free or paid: **Free** (subscriptions are sold in-app)
- [x] Accept Play App Signing and create package `com.dayova`.
- [x] Save the Play app ID and service-account/project linkage for EAS Submit.

Play app ID: `4976075040375716512`; production track ID:
`4697718440238285251`.

The authorized operator confirmed the Play app creation and review submission.
No account credentials or signing secrets are stored in this checklist.

## 3. Store presence

- [x] Paste the de-DE copy from [`store-listing-de-DE.md`](./store-listing-de-DE.md).
- [x] Upload [`assets/play-store-icon-512.png`](./assets/play-store-icon-512.png).
- [x] Upload [`assets/feature-graphic-1024x500.png`](./assets/feature-graphic-1024x500.png).
- [x] Upload the eight current Android phone screenshots documented in
      [`assets/README.md`](./assets/README.md).
- [x] Verify category **Education** and current support email `kontakt@dayova.de`.
- [x] Add `https://dayova.com/datenschutz` for the submitted review.
- [ ] Reconcile the now-published app-inclusive policy under DAY-217/DAY-359
      with Android billing and actual release behavior; see the
      [Data safety draft](./data-safety-draft.md). Publication is not evidence
      that consent, retention, or deletion is complete.

## 4. App content declarations — live state

Console lists ten actioned declarations with no outstanding prompts on September
16. This is a workflow status, not proof the answers match the app.

| Form | Observed response | Status / remaining evidence |
| --- | --- | --- |
| Privacy policy | `https://dayova.com/datenschutz` | Redirects to app-inclusive `https://dayova.com/privacy`; reconciliation remains under DAY-217/DAY-359. |
| App access | Actioned; historical instructions specify a synthetic account with permanent `dayova_full_access` | Reviewer login was not exercised. Credentials remain in Console. |
| Ads / Advertising ID | No / No | Actioned; summaries inspected. |
| Content rating | USK all ages; PEGI 3, among other ratings | Actioned; different from the target-audience field. |
| Target audience and content | 13–15, 16–17, 18+ | Actioned; DAY-357 still owns reconciliation with actual product/marketing scope. |
| Data safety | **No collection/sharing** | **Incorrect no-collection claim**, confirmed in the saved form and public declaration. Reconcile with the engineering inventory before correcting the declaration. |
| Government apps | No | Actioned; summary inspected. |
| Financial features | No | Actioned; summary inspected. |
| Health apps | No | Actioned; summary inspected. |
| News / COVID-19 | Not separate entries among the ten actioned declarations | No separate answers verified; do not infer applicability. |
| Account deletion | Historical claim of submission not independently substantiated | DAY-183/DAY-360/DAY-362/DAY-363 remain open until the public resource and end-to-end deletion flow work. |

## 5. Monetization and subscriptions

- [x] Verify active Germany base plans: `dayova_monthly:monthly-autorenewing`
      and `dayova_annual:annual-autorenewing`.
- [ ] Verify exact per-product Play prices against the commercial target of
      **€14.99 monthly** and **€155.88 annually**. The public listing shows that
      price range, but the annual base-plan price table failed to load.
- [x] Verify both products are attached to RevenueCat `dayova_full_access` and
      its default offering.
- [x] Verify `$rc_monthly` maps to `dayova_monthly:monthly-autorenewing` and
      `$rc_annual` maps to `dayova_annual:annual-autorenewing`. Package identifiers
      and Play product IDs are different fields; the client requires these exact
      package identifiers.
- [x] Add `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to the EAS **production**
      environment using the Android public SDK key.
- [ ] Keep external parent web checkout disabled in the Android app unless
      Dayova separately qualifies for and implements an applicable Google
      program. Digital learning subscriptions normally use Google Play Billing.
- [ ] Test purchase, restore, pending/cancelled purchase, expiration, account
      switching, and the active 14-day no-card trial state.

RevenueCat project `413fab77` is connected. The production EAS environment has
both public platform keys and production Convex has the server key. Secret
values are intentionally omitted; old/exposed temporary keys were revoked.

## 6. Release candidate and submission

- [x] Build and artifact-audit app/runtime `1.0.5`, version code `23`: EAS build
      `b8c2cdc4-076f-4569-90e2-6135fdb4bbe8`, source
      `f1aff0f53708ca45b884100a8693a0209b983e2a`. Exact fingerprint, embedded
      update, AAB hash, and validation are in the
      [candidate audit](./release-candidate-audit.md).
- [x] Upload that signed AAB once through EAS submission
      `74999aaa-d7a9-4cda-b83a-e97e965066b7`, finished on 2026-09-07.
- [x] Confirm Internal testing availability of `1.0.5`/code `23` in Play Console.
- [x] Promote the same bundle to Closed Alpha and Open testing and replace the
      unfinished Production `1.0.4`/code-21 draft.
- [x] Send Production, Open testing, and Closed Alpha full rollouts plus resuming
      Open testing for review, preserving Germany targeting.
- [x] Confirm all four tracks show `1.0.5`/code `23` available on September 16.
      Installed-build evidence remains outstanding; do not repeat submission.
- [ ] Install from the Play opt-in link on a clean physical Android device and a
      supported emulator/device size.
- [ ] Verify signup/login, onboarding, trial, plans, uploads, learning session,
      analysis, notifications, purchases, restore, privacy/support links,
      subscription management, logout, and complete account deletion.
- [x] Capture and upload current Android screenshots with synthetic data.
- [ ] Attach the build ID, source SHA, AAB hash, device/OS, tester, and results to
      DAY-218/DAY-248.

## 7. Production release

- [x] Submit the selected build-23 changes to Google review on 2026-09-07.
      Automated quick checks were still running at submission confirmation.
- [x] Preserve Germany targeting and set the Production, Open testing, and
      Closed Alpha rollout percentages to 100%.
- [x] Record Managed publishing off; approved changes publish automatically.
- [x] Record no blocking Play validation errors and one nonblocking missing
      deobfuscation-file warning; native debug symbols are attached.
- [x] Verify Production availability in Console and the public German listing;
      no unpublished changes remain. Current DEX/edge-to-edge/large-screen
      warnings are recorded in the [live report](../live-verification-2026-09-16.md).
- [ ] After availability, install build 23 from the public listing and record
      the exact artifact, device, and QA evidence in DAY-218/DAY-248.
- [ ] Replace `release/production-ota-baseline.json` only after both platforms
      satisfy the [baseline requirements](../README.md), including exact
      distributed-binary verification and staging checks. Submission alone is
      insufficient.

DAY-218/DAY-325 are completed historical tasks. Use DAY-248 for current binary
and OTA evidence, DAY-414 for both-platform publication, and reconcile active
ownership for any remaining account/billing work before acting on old items.
