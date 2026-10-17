# Standalone hint comparison builds

Jakob requested a version Julius can run without Metro. Julius uses an iPhone, so `validation-testflight` is the primary distribution profile. Both profiles embed the same Inline/Extraansicht editor and deterministic examples v1 from #884. Before handing over the device, choose Settings → Hinweisvergleich (Test), then a new exam or an existing draft. The study protocol remains in [DAY-517](https://linear.app/dayova/issue/DAY-517) and the [Product decision record](https://app.notion.com/p/3fb2e87228bf817a880dde6127a1996a).

## Shared boundary

- JavaScript and assets are embedded; Expo updates are disabled to pin the study revision. No Metro, tunnel or development launcher is required. Internet is still needed for login, catalog search and saving.
- Both profiles pin the verified `kindred-canary-599` development backend. Its Clerk issuer matches the configured Clerk test instance. Config rejects a live Clerk key, another backend, enabled PostHog or the production app variant. No authentication or trial/access checks are bypassed.
- Only public client SDK keys are supplied through EAS. No secret/admin key is added or committed. Custom EAS environments are unavailable on this plan; the profiles therefore use existing development/preview environments with an explicit backend pin.
- The moderator menu is enabled by an explicit internal-build marker. Normal production config has no marker and keeps Inline as its default. Device-local assignment persists and freezes for a mounted flow. Reopen the flow after switching. No participant randomization or recording of raw free text is added. Restore Inline after the study; use a new exam for the second scenario.

## iPhone / TestFlight

- `validation-testflight` is a store-signed TestFlight build, not an App Store release. It reuses the existing App Store app `de.dayova.app` and its current 1.0.7 train; ordinary release configuration/version is unchanged. The app label is Dayova Test and its scheme is `dayova-validation`.
- **Installing this TestFlight build replaces the installed Dayova app on that iPhone.** Sign in with a development/test account, not a production account. Development data is separate; existing production credentials are not accepted as test credentials. Julius already belongs to the internal Team (Expo) group; no new Apple account permissions are needed.
- RevenueCat's Test Store intentionally rejects iOS Release/TestFlight builds. TestFlight therefore uses the existing public App Store SDK key (`appl_` prefix) from EAS **preview**, with Apple's sandbox. This does not change the production environment or permit real TestFlight charges. The Test Store key is not forced into a release build.
- Reproduce with authenticated EAS: `eas build --platform ios --profile validation-testflight`. The CLI initially evaluates app config before fetching remote variables; export the configured public test values into the process environment (or use `eas env:exec`) with no PostHog. A `.env.local` file alone is insufficient because this profile disables dotenv loading. Retain the explicit profile backend pin. Do not commit local environment files. Submit the finished build to app ID 6768416097 using the existing submission credentials; assign only the internal group. Do not submit an App Store version for review or add the external students group.

## Supplementary Android profile

- `validation` builds an APK for ARM64 phones and x86_64 emulators under the separate package `com.dayova.validation`; it does not replace ordinary Dayova/development installs.
- The existing RevenueCat Test Store public SDK key (`test_` prefix) is configured in EAS **development**. RevenueCat intentionally crashes non-debuggable Android releases using this key. A dedicated `validation` build type inherits release dependencies and bundling while remaining debuggable for Test Store. React developer support is disabled only in that build type; ordinary debug builds retain it. Validation is not listed among variants which skip JS bundling. It uses internal debug signing and is never submitted to an app store.
- Reproduce with `eas build --platform android --profile validation`; download the APK from its internal distribution page.

## Acceptance and provenance

Record source SHA, EAS build ID, marketing/build version and tested device in #884 and DAY-517. Verify cold launch without Metro, test sign-in/trial, both placements, contextual examples, own-topic selection and save/back/pause/reopen. Build/config checks do not substitute for a physical iPhone/VoiceOver acceptance or student validation. Keep credentials and raw keys out of evidence. Build and distribution status must be described as pending until Apple has processed the build and the internal group can install it.
