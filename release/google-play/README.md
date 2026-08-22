# Google Play launch command center

Last audited: 2026-08-22

This directory is the handoff pack for the first Dayova Google Play release.
It contains everything that can be prepared without making legal declarations,
accepting Google agreements, paying fees, or releasing a build to users.

## Current verdict

**Not ready for production submission.** The package name, target API level,
store copy, artwork, disclosure inventory, and submission sequence are ready.
The following release gates still need evidence:

| Gate | Current evidence | Required completion |
| --- | --- | --- |
| Play Console organization account | The Google account inspected on 2026-08-22 only showed the developer-account type chooser. DAY-325 is marked Done but contains no completed acceptance/verification evidence. | Julius signs in to the verified organization account or invites the release operator with sufficient Play Console permissions. Record owner, developer ID, accepted agreements, paid fee, and verified status. |
| Target audience and Families policy | Dayova is built for learners in grades 6–13, so children under 13 may be part of the intended audience. No approved target-age declaration was found. | Product/legal explicitly chooses the Play target-age groups and confirms whether Families requirements apply. Do not guess from the Apple 4+ rating. |
| App privacy policy and account deletion | `dayova.com/datenschutz` explicitly describes the website. The app has no public deletion-request page, and its visible deletion action only deletes the Clerk user from the expired-trial management flow. | Publish an app-specific privacy policy and functional public deletion page; implement an easy-to-find in-app deletion route with server-side data cleanup, all-session invalidation, retention exceptions, and confirmation. Tracked by DAY-217 and DAY-183. |
| Android subscriptions | RevenueCat is implemented, but the production EAS environment has no Android public SDK key. Android products/offering/store-link evidence is also missing. | Create matching Google Play base plans, connect them in RevenueCat, add the Android public SDK key to EAS production, and pass sandbox purchase/restore/expiry tests. Never ship a RevenueCat Test Store key. |
| Current release candidate | The only downloaded AAB is an older 1.0.4 build from a different source revision. The installed emulator client is also too old to render current SDK 57 JavaScript. | Approve the 1.0.5 runtime boundary, build the current source as Android version code 20, install through Play internal testing, and capture current Android screenshots. |

## Recommended fastest safe path

1. **Restore Play Console access.** Use the verified organization account or
   invite the current operator. Complete account verification before app setup.
2. **Make the two policy decisions.** Approve the target-age groups and the
   app-specific privacy/deletion position. These answers change Play forms and
   implementation, so they cannot be inferred safely.
3. **Finish DAY-183 and DAY-217.** Account deletion and the public privacy URL
   are launch blockers, not post-launch cleanup.
4. **Configure Android billing.** Create the monthly and annual Play base plans,
   connect them to the RevenueCat entitlement/offering, add the production
   Android public key, and keep parent web checkout disabled in the Android app.
5. **Cut the release candidate.** Set the global app/runtime version to 1.0.5,
   let EAS auto-increment Android to version code 20, and build from the exact
   reviewed commit. See [`release-candidate-audit.md`](./release-candidate-audit.md).
6. **Upload to internal testing first.** Complete Play App Signing, install the
   Play-delivered build, exercise signup/trial, purchases, restore, expiry,
   uploads, notifications, privacy links, and deletion. Capture screenshots
   from that build.
7. **Complete the Play forms.** Use [`play-console-checklist.md`](./play-console-checklist.md),
   [`store-listing-de-DE.md`](./store-listing-de-DE.md), and
   [`data-safety-draft.md`](./data-safety-draft.md). Resolve every `BLOCKED` or
   `CONFIRM` marker before saving a declaration.
8. **Roll out production.** Submit only after internal-test evidence is attached
   to DAY-218. For an ASAP release, leave Managed publishing off only if Dayova
   accepts automatic availability immediately after Google approval.

Google may require additional testing for some newer personal developer
accounts. The intended Dayova account is an organization account, so record the
actual Console requirement rather than assuming the personal-account rule.

## Release ownership

| Workstream | Suggested owner | Tracker |
| --- | --- | --- |
| Play organization access and agreements | Julius / account owner | DAY-325 |
| App privacy, target ages, retention | Product + legal | DAY-217 |
| Account deletion implementation | App/backend | DAY-183 |
| Play products and RevenueCat Android setup | Billing owner | DAY-228 |
| Build, internal test, screenshots, submission | Release operator | DAY-218 / DAY-248 |

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

Creating the developer account, accepting agreements, paying the registration
fee, making legal/target-audience declarations, enabling a production rollout,
and releasing to users require an authorized human at the action point. This
pack intentionally does not claim those actions are complete.
