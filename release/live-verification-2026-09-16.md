# Live release verification — 16 September 2026

Read-only verification using the release operator's signed-in Play Console,
App Store Connect, RevenueCat, and Expo sessions, the public German Play
listing, and the Production PostHog connector. This supplements the dated
artifact records; it does not certify device behavior or legal compliance.

## Distribution and OTA

| Surface | Observed state | Evidence |
| --- | --- | --- |
| Google Production | Active; 1.0.5, code 23, available on Google Play; released September 7 at 22:00 as displayed by Console; Germany targeted | [Production releases](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/tracks/production?tab=releases) |
| Google Internal | Active; 1.0.5/code 23 available to internal testers; September 7 at 21:28 as displayed | [Internal](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/tracks/internal-testing) |
| Google Closed Alpha | Active; 1.0.5/code 23 available to selected testers; September 7 at 22:00 as displayed | [Alpha](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/tracks/4699545655221865880) |
| Google Open | Active; 1.0.5/code 23 available to unlimited testers; September 7 at 22:00 as displayed | [Open](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/tracks/open-testing) |
| Google publishing | Last published September 7; no unpublished changes; Managed publishing off | [Publishing overview](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/publishing) |
| Apple | App Store listing version **1.0**, Ready for Distribution, selecting binary **1.0.4 (72)**; publicly distributed in Germany, Austria, Switzerland | [Version](https://appstoreconnect.apple.com/apps/6768416097/distribution/ios/version/deliverable), [availability](https://appstoreconnect.apple.com/apps/6768416097/distribution/pricing) |
| iOS EAS provenance | Finished production build `85e250ca-ed9a-4e52-9896-f7a5f39fa967`, 1.0.4 (72), source `e027014b4d4b053f9fc54364ab90388722e5c526`, fingerprint `c52495b739c9d34b8726d8a392f9e008c7e9eb31` | [EAS build](https://expo.dev/accounts/dayova/projects/dayova/builds/85e250ca-ed9a-4e52-9896-f7a5f39fa967) |
| Production OTA | Active channel maps to branch `production`. Pinned CLI `channel:view production --json` reports latest group `6469f3cd-078b-4d0a-b31a-f0b9c52e93ab`, runtime 1.0.3, July 17, source `089eec8ca158ec87b9aba5042c7a04c30878f276`. Runtime 1.0.5 view shows no published updates. | [Channel](https://expo.dev/accounts/dayova/projects/dayova/channels/production) |

The July production update cannot match either current store binary's runtime.
The schema-1 [baseline](./production-ota-baseline.json) remains historical and
must not be promoted merely because store availability is now confirmed.
DAY-248's exact installed-build/embedded-update evidence, matching iOS native
upgrade, and DAY-414's both-platform workflow remain prerequisites.

## Live billing configuration

[Play subscriptions](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/subscriptions)
contain `dayova_monthly` with active `monthly-autorenewing` and `dayova_annual`
with active `annual-autorenewing`, both for Germany and last updated September 9.
The public German listing displays an in-app purchase range of €14.99–€155.88.
The annual base-plan price table failed to load even after one reload; exact
per-product Play prices were not independently read from that table.

RevenueCat's [default offering](https://app.revenuecat.com/projects/413fab77/product-catalog/offerings/ofrng94eccb3528)
and [dayova_full_access entitlement](https://app.revenuecat.com/projects/413fab77/product-catalog/entitlements/entle54840f8ad)
both contain the native products:

| Package | Google Play product:base plan | Apple product |
| --- | --- | --- |
| `$rc_monthly` | `dayova_monthly:monthly-autorenewing` | `com.dayova.abonnement.monthly` |
| `$rc_annual` | `dayova_annual:annual-autorenewing` | `com.dayova.abonnemment.yearly` |

The spelling of the Apple annual identifier is the actual configured ID.
Apple's [subscription group](https://appstoreconnect.apple.com/apps/6768416097/distribution/subscription-groups/22304185)
shows both products Approved. German prices read from their current pricing
tables are €14.99 monthly and **€155.99 annually**, not the €155.88 Play/web
commercial target. Always display the price returned by the relevant store.

These are configuration checks, not purchase/restore/renewal/expiry/refund or
account-switching QA. RevenueCat also displayed an ongoing
[Google Play notification incident](https://status.revenuecat.com/incidents/4sjpxh35lqfr)
at inspection time; recheck that status when performing lifecycle QA.

## Material discrepancies requiring follow-up

1. **Google Data safety is incorrect.** The saved
   [form](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/app-content/data-privacy-security)
   selects **No** for collecting or sharing required data types. The
   [public declaration](https://play.google.com/store/apps/datasafety?id=com.dayova&hl=de&gl=DE)
   accordingly says no user data is collected or shared. Account, learner,
   uploaded-content and purchase processing contradict the no-collection claim.
   Reconcile and submit the [engineering inventory](./google-play/data-safety-draft.md)
   under DAY-217/DAY-359; third-party sharing classifications still need their
   own assessment. The saved answer was not changed during this audit.
2. **Apple's live policy and support links are broken.** App Privacy and the
   approved version reference `https://dayova.com/app/privacy`; Support URL is
   `https://dayova.com/app/support`. Both rendered a 404 in the browser. The
   working `https://dayova.com/privacy` does not repair these configured URLs.
   Restore appropriate public routes or reconcile the store metadata and links,
   then verify the exact URLs end to end.
3. **The working policy still needs reconciliation.**
   [dayova.com/datenschutz](https://dayova.com/datenschutz) redirects to
   [the app-inclusive policy](https://dayova.com/privacy), dated September 4.
   It omits Android billing from its payment section and still describes voice
   permissions/features removed from this release. Its support-based deletion
   instructions and retention promises do not prove an implemented deletion
   pipeline. Keep the existing privacy/deletion work open.
4. **Production has an additional optimization warning.** The
   [release dashboard](https://play.google.com/console/u/0/developers/4912315867079102345/app/4976075040375716512/tracks/production)
   reports DEX obfuscation at 5%, below its 25% threshold, with a February 2027
   deadline. It also recommends resolving deprecated edge-to-edge APIs and
   large-screen restrictions. These are current follow-ups; they do not negate
   the observed active release. Crash/ANR rates were unavailable, not zero.

## Listing, declarations, analytics, and assets

The [public German listing](https://play.google.com/store/apps/details?id=com.dayova&hl=de&gl=DE)
matches the repo's app name, short/full description, Education category, free
download with in-app purchases, website, and privacy URL. It has eight screenshot
entries. Current support email is **kontakt@dayova.de**; current 1.0.5 release
notes are recorded in [the listing file](./google-play/store-listing-de-DE.md).

Console lists ten actioned declarations and no outstanding declaration prompts.
The expanded summaries show no ads, advertising ID, health or financial
features, or government affiliation; target ages are 13–15, 16–17, and 18+.
Content ratings include USK all ages and PEGI 3. Content ratings and the declared
target audience are different fields. “Actioned” is not evidence that the
no-collection answer is correct. Reviewer login was not exercised and no
credentials were copied.

Production PostHog project `190091` reports `anonymize_ips: true`. Its
`dashboard_viewed` schema includes GeoIP city/postcode/coordinates and identity
properties. A bounded aggregate query for September 9–16 returned no dashboard
events, so it cannot establish current enrichment or its absence. The historical
DAY-216 evidence remains unresolved; verify a controlled release event and
server-side transformation settings. No individual identity or location values
are included here. See [PostHog data-storage controls](https://posthog.com/docs/privacy/data-storage).
Do not infer mobile replay from project-wide replay settings; platform SDK
configuration matters, and this source disables PostHog on iOS.

All 19 local PNGs have the documented dimensions/color types and the three
artwork byte sizes match the manifest. All eight composed screenshots were
visually inspected. They preserve August UI, not verified build-23 captures;
no comparison against an installed current binary was performed. The analysis
image shows evidence statuses but no visible learning gap. Cropping clips some
edge content and long titles are truncated, so preserve the dated provenance
and refresh the set when validating the exact store build.

## Verification limits

No store installation, purchase, cancellation, refund, destructive account
deletion, production setting change, new build, submission, or OTA publication
was performed. The September 7 artifact checksum/signature audit was not rerun.
Play-owner payments notices, contractual/retention evidence, exact store-binary
traffic, AI consent, full deletion behavior, and tester-specific opt-in access
remain unverified. This report records observed operational facts and remaining
work; it does not close those checks by inference.
