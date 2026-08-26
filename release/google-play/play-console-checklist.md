# Play Console submission checklist

Last updated: 2026-08-23

This checklist records the submitted state and the remaining launch work. The
old build 15 AAB was not used as the production candidate.

## 1. Developer account

- [x] Sign in to the verified Dayova **organization** developer account.
- [ ] Complete the durable DAY-325 evidence set: account owner and developer ID
      are known; public developer name, fee receipt, and agreement/verification
      evidence still need one recorded source.
- [x] Invite the release operator with the minimum permissions needed to create
      and release `com.dayova`.
- [x] Verify that the release operator can open the Dayova Organization profile
      in Google Payments Center as **Admin, primary contact**. Payments Center
      showed no alerts on 2026-08-23.
- [ ] Have Julius open Play Console's owner-only Payments profile page and
      confirm or resolve the previously reported payments-account action.
- [ ] Reconfirm the public developer email, address, and phone shown by Google
      before public availability. Organization contact details may be displayed
      on Google Play.

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
- [x] Set category **Education** and support email `contact@dayova.de`.
- [x] Add `https://dayova.com/datenschutz` for the submitted review.
- [ ] Replace/extend the website-specific text with the approved app-specific
      policy under DAY-217/DAY-359; submission is not completion evidence.

## 4. App content declarations

| Form | Draft response | Status |
| --- | --- | --- |
| Privacy policy | `https://dayova.com/datenschutz` | Submitted/in review; website-specific mobile-app gap remains under DAY-217/DAY-359. |
| App access | Restricted by login; dedicated synthetic reviewer account has permanent `dayova_full_access` | Submitted/in review; credentials exist only in Play Console. |
| Ads | No | Submitted/in review. |
| Content rating | Completed from current app content | Submitted/in review. |
| Target audience and content | 13+ | Submitted/in review; DAY-357 still owns reconciliation with actual product/marketing scope. |
| News apps | No | Confirm. |
| COVID-19 contact/status | No | Confirm. |
| Data safety | Submitted from the current release draft | In review; legal/technical reconciliation and privacy/deletion implementation verification remain open. |
| Government apps | No | Confirm. |
| Financial features | No; ordinary subscription billing does not make Dayova a financial-services app | Confirm form wording in current Console. |
| Health apps | No | Submitted/in review. |
| Account deletion | Console declaration submitted | DAY-183/DAY-360/DAY-362/DAY-363 remain open until the public resource and end-to-end deletion flow work. |

## 5. Monetization and subscriptions

- [ ] Create monthly and annual subscriptions/base plans in Google Play. Use
      stable product IDs agreed with RevenueCat; do not invent IDs during setup.
- [ ] Configure Germany pricing to match the approved commercial intent:
      **€14.99 monthly** and **€155.88 annually** (effective €12.99/month), then
      review taxes and Play-localized prices before activation.
- [ ] Connect both products to the existing RevenueCat entitlement and current
      offering.
- [ ] Verify the RevenueCat offering exposes package `$rc_monthly` for Play
      product `dayova_monthly` and package `$rc_annual` for Play product
      `dayova_annual`. Package identifiers and Play product IDs are different
      fields; the client requires these exact package identifiers.
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

- [x] Keep the approved app/runtime version at `1.0.3` and build Android version
      code `20` from source
      `31f7f25787d2c4cdfde96384379f47b3e321fc17`.
- [x] Build `com.dayova` with EAS production profile: build
      `1b52de89-746d-4600-9670-7c395079ff02`.
- [x] Submit to Production for Germany: submission
      `d3e7d523-cac4-4be9-a55c-2245d1095972`.
- [x] Prepare the exact `1.0.3` / version-code-`20` artifact for Closed and Open
      testing without creating another build. Configure the existing Dayova
      internal list as the deferred Closed audience and keep Germany selected.
- [x] Cancel the Play warning that would restart the Production review. Leave
      all four Closed/Open changes under **Changes not yet submitted for review**
      until the Production review resolves.
- [ ] After Production review resolves, revalidate the saved test-track drafts,
      add the approved feedback channel, audit the EAS service-account
      permissions, and only then submit Closed/Open for review.
- [ ] Install from the Play opt-in link on a clean physical Android device and a
      supported emulator/device size.
- [ ] Verify signup/login, onboarding, trial, plans, uploads, learning session,
      analysis, notifications, purchases, restore, privacy/support links,
      subscription management, logout, and complete account deletion.
- [x] Capture and upload current Android screenshots with synthetic data.
- [ ] Attach the build ID, source SHA, AAB hash, device/OS, tester, and results to
      DAY-218/DAY-248.

## 7. Production release

- [x] Complete the Console release checklist and submit the selected changes to
      Google review. Automated quick checks passed.
- [x] Select Germany-first countries/regions.
- [x] Decide Managed publishing:
  - Off = fastest; the app becomes available after approval.
  - On = approval is held for a later manual publish action.
- [x] Create the Production release from the tested artifact; add the release
      notes from [`store-listing-de-DE.md`](./store-listing-de-DE.md).
- [x] Review warnings, device availability, declarations, and rollout. The
      missing deobfuscation mapping is recorded as non-blocking.
- [x] Obtain authorized human confirmation immediately before **Start rollout
      to Production**.
- [ ] Monitor Google review without unnecessary resubmission. Managed publishing
      is off, so approval should publish automatically.
- [ ] After availability, install from the public listing and record the exact
      distributed build in `release/production-ota-baseline.json` before relying
      on production OTA updates.
