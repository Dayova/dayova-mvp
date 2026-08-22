# Play Console submission checklist

Last updated: 2026-08-22

Follow this in order. Do not upload the old build 15 AAB as the production
candidate.

## 1. Developer account

- [ ] Sign in to the verified Dayova **organization** developer account.
- [ ] Record the account owner, developer account ID, public developer name,
      verified organization status, fee receipt, and agreement acceptance in
      DAY-325.
- [ ] Invite the release operator with the minimum permissions needed to create
      and release `com.dayova`.
- [ ] Confirm the public developer email, address, and phone shown by Google are
      correct. Organization contact details may be displayed on Google Play.

## 2. Create the app

- [ ] App name: **Dayova**
- [ ] Default language: **German (Germany) — de-DE**
- [ ] App or game: **App**
- [ ] Free or paid: **Free** (subscriptions are sold in-app)
- [ ] Accept Play App Signing and create package `com.dayova`.
- [ ] Save the Play app ID and service-account/project linkage for EAS Submit;
      add an Android submit profile only after the Play app exists.

Creating a Play app and accepting declarations are external account changes and
need the authorized operator's confirmation at the action point.

## 3. Store presence

- [ ] Paste the de-DE copy from [`store-listing-de-DE.md`](./store-listing-de-DE.md).
- [ ] Upload [`assets/play-store-icon-512.png`](./assets/play-store-icon-512.png).
- [ ] Upload [`assets/feature-graphic-1024x500.png`](./assets/feature-graphic-1024x500.png).
- [ ] Upload at least two current Android phone screenshots from the Play
      internal-test build; four are specified in [`assets/README.md`](./assets/README.md).
- [ ] Set category **Education** and support email `contact@dayova.de`.
- [ ] Add the final app-specific privacy-policy URL. `BLOCKED` by DAY-217.

## 4. App content declarations

| Form | Draft response | Status |
| --- | --- | --- |
| Privacy policy | Final public app-policy URL | `BLOCKED` — current page describes the website only. |
| App access | Some/all functionality restricted by login; provide a dedicated reviewer account and exact navigation steps | Reviewer credentials and verified delete path still needed. |
| Ads | No | Confirm final manifest/dependencies. |
| Content rating | Education; answer the IARC questionnaire from actual app content | Must be completed in Console; do not copy the Apple age rating. |
| Target audience and content | `BLOCKED` — explicit age groups not approved | Grades 6–13 include potentially under-13 learners. Product/legal must select the groups and assess Families policy. |
| News apps | No | Confirm. |
| COVID-19 contact/status | No | Confirm. |
| Data safety | Use [`data-safety-draft.md`](./data-safety-draft.md) after legal/technical reconciliation | `BLOCKED` by privacy/deletion and final SDK audit. |
| Government apps | No | Confirm. |
| Financial features | No; ordinary subscription billing does not make Dayova a financial-services app | Confirm form wording in current Console. |
| Health apps | No | Confirm. |
| Account deletion | In-app deletion route plus public functional request URL | `BLOCKED` by DAY-183. |

## 5. Monetization and subscriptions

- [ ] Create monthly and annual subscriptions/base plans in Google Play. Use
      stable product IDs agreed with RevenueCat; do not invent IDs during setup.
- [ ] Configure Germany pricing to match the approved commercial intent:
      **€14.99 monthly** and **€155.88 annually** (effective €12.99/month), then
      review taxes and Play-localized prices before activation.
- [ ] Connect both products to the existing RevenueCat entitlement and current
      offering.
- [ ] Add `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` to the EAS **production**
      environment using the Android public SDK key.
- [ ] Keep external parent web checkout disabled in the Android app unless
      Dayova separately qualifies for and implements an applicable Google
      program. Digital learning subscriptions normally use Google Play Billing.
- [ ] Test purchase, restore, pending/cancelled purchase, expiration, account
      switching, and the active 14-day no-card trial state.

## 6. Release candidate and internal testing

- [ ] Approve the 1.0.5 runtime/version recommendation in
      [`release-candidate-audit.md`](./release-candidate-audit.md).
- [ ] Build `com.dayova` from the exact reviewed commit with the EAS production
      profile. Expected next remote version code: **20**.
- [ ] Upload/submit the AAB to **Internal testing**, not Production.
- [ ] Install from the Play opt-in link on a clean physical Android device and a
      supported emulator/device size.
- [ ] Verify signup/login, onboarding, trial, plans, uploads, learning session,
      analysis, notifications, purchases, restore, privacy/support links,
      subscription management, logout, and complete account deletion.
- [ ] Capture current Android screenshots after synthetic data is loaded.
- [ ] Attach the build ID, source SHA, AAB hash, device/OS, tester, and results to
      DAY-218/DAY-248.

## 7. Production release

- [ ] Confirm every Console dashboard task is green and all blockers above are
      resolved with evidence.
- [ ] Select Germany-first countries/regions, unless product approves a broader
      launch.
- [ ] Decide Managed publishing:
  - Off = fastest; the app becomes available after approval.
  - On = approval is held for a later manual publish action.
- [ ] Create the Production release from the tested artifact; add the release
      notes from [`store-listing-de-DE.md`](./store-listing-de-DE.md).
- [ ] Review warnings, device availability, pricing, declarations, and rollout.
- [ ] Obtain authorized human confirmation immediately before **Start rollout
      to Production**.
- [ ] After availability, install from the public listing and record the exact
      distributed build in `release/production-ota-baseline.json` before relying
      on production OTA updates.
