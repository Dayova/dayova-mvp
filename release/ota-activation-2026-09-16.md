# Production OTA activation evidence - 16 September 2026

Status (updated September 17): iOS 75 and Android 25 passed physical-device
installation and cold-launch checks. Both staging platforms have direct running
OTA UUID evidence. This PR prepares the schema-2 baseline; production remains
blocked on main pending the final preflight and integrated-candidate staging.
The initial preflight exposed test-tooling-only fingerprint drift; the narrowly
reviewed native-equivalence records below address that specific mismatch.
Build completion, store availability,
installation, OTA download and OTA launch are separate checks.

## Integrated source and compatibility

PRs [#633](https://github.com/Dayova/dayova-mvp/pull/633) and
[#634](https://github.com/Dayova/dayova-mvp/pull/634) are merged. The final build
source is `96f8fe31bac3cccc6100b703d06ce7f9b27aefa5`.

The [main workflow](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a0aba6-3595-789f-9926-15532a5b512a)
produced these CNG fingerprints using the production environment:

| Platform | Production build | Version | Fingerprint |
| --- | --- | --- | --- |
| iOS | `2ae80681-ef8f-49a6-960d-2db6de8cf20e` | 1.0.5 (75) | `1b690a3f1a0c5ac4d73873da35ab9c2ca695d807` |
| Android | `d6391ea9-9f3f-4132-bf2a-f62030a236fa` | 1.0.5 (25) | `d91ab0f33529c36e5e7a76ef4e9a0a3bb66f26a1` |

Both builds record this exact source and matching fingerprints. The main workflow
completed successfully and skipped production publication under the closed guard.
Store-installation and device evidence for both platforms is recorded below.

iOS 75 artifact SHA-256:
`a1aa27d94a5cd7f12220c5f039ce9544cb99941b389ce6c906f28e7b9753e51a`.
The downloaded IPA identifies `de.dayova.app`, version 1.0.5, production channel,
runtime 1.0.5, enabled updates with launch check ALWAYS and zero wait, and embedded
update `e7f68437-b01d-40ed-96c3-80ecbbcb40ec`. Its signing profile is the same
verified profile listed below. EAS submission
`006bc404-6af1-4ee7-bbdd-fd88da508532` resulted in App Store Connect build
`c929a73d-e3f0-43f1-b02e-6be122ec224f`, upload status Complete, assigned to
Team (Expo), four internal testers. This proves processing and availability,
not installation on a physical device by itself.

### Physical TestFlight installation and cold launch

The owner's 17.56-second recording shows TestFlight 1.0.5 (75) at 0.5 seconds,
opening the app to its authenticated home at 2.0–4.0 seconds, and navigation to
Mehr at 5.5–6.5 seconds. Complete-timeline inspection covered 35 frames at
0.5-second intervals in three contact sheets; audio was not transcribed. The
recording does not show a preceding force-quit. On September 17, after completing
the separate staging check below, the owner explicitly confirmed reinstalling
75, opening it, fully closing it and reopening it normally. The video proves
installation/opening; the cold-launch result is owner-reported.

Recording SHA-256:
`b3e5571b575449f636a897b25025b4e02f06d326f333bb25140beb7cb0a8fa41`.
Private original media remains local and is not committed. Build 75's embedded
JavaScript predates the App-Informationen dialog; its absence before a production
OTA is expected and is not evidence of a broken build.

There are no changes in app source, native dependencies, patches, assets, or app
configuration between the earlier tested source
`4e01f2c80a4672aca23c1c8af2413d4931e55348` and this integrated source. The changes
are release workflows, build profiles, guard/publisher scripts, tests and the
runbook. Adding build profiles changes the fingerprint input `eas.json`; the
earlier production 73/24 hashes must not be copied into the new baseline.

Android 25 artifact SHA-256:
`85b2db0975da50e7bc589502d7a154dd5ff61877e4d5ef76a3410b7b5077921e`.
The AAB embeds update `24f4a03e-9a27-41b9-817c-da3a2d8335e8`, runtime 1.0.5,
production channel and package `com.dayova`. EAS internal submission:
`df81769f-1ef8-403c-9e8f-1ce738798c39`; EAS submission succeeded; Play Console internal release 3 lists code 25 as available
to internal testers (16 September, 21:53 as displayed). The owner manually downloaded the Play-generated universal APK after Edge
blocked the automated download.

Play-signed APK SHA-256:
`f34c8a06a3c8e75fec0c58424ea00bfbc4638db474e0a7407e3cf2c1f50154c6`.
Its embedded manifest and JavaScript bundle match the submitted AAB byte for
byte. `aapt2` confirms package com.dayova, code 25, version/runtime 1.0.5,
production channel, enabled updates, ALWAYS launch check and zero wait.
`apksigner` verifies v2/v3 signatures and the Google source stamp for API 24-36;
signer certificate SHA-256:
`aef70b4fb244ccafd0435b2ffd7fad6292a3ef175315df6ff77535c70a00c1af`.
The installed Java 17 verifier cannot check the additional API-37 hybrid ML-DSA
signature, so no claim is made for that separate verification.

The isolated API-34 emulator successfully installed the exact Play APK at
22:06 local time after removing its disposable staging install (the EAS upload
key and Play app-signing key differ). Android package metadata reports code 25
and version 1.0.5. On launch, Google Play automatic protection invokes
`com.pairip.licensecheck.LicenseActivity` and redirects the signed-out emulator
to the Play Store sign-in screen. This is installation evidence, not a verified
Dayova launch. A legitimate tester-account Play installation/launch remains
required; no installer spoofing or protection bypass was performed.

Before the successful Play installation described below, the owner's physical
Pixel 9 (API 37) also accepted the exact Play APK through
an ordinary `adb install -r`, updating code 23 to 25 while preserving the original
first-install timestamp and app data. This is OS installation/signature-acceptance
evidence on API 37, not a claim that the Java 17 verifier checked its hybrid
signature. The replacement reports no installer package, so it is not evidence
of installation through the Play Store. Launch still displays "Get this app from
Play". The owner authorized accepting the internal-test invitation for their work
account, and the web page confirmed tester membership. After selecting that
account on the Pixel, Play identified the existing app as associated with a
different personal account and requested an invitation for that account. Opening
Dayova still returned to the Play installation prompt. With separate owner consent,
the associated personal account was then added to the same internal-test list
and accepted its invitation; Play Console lists two testers and both web
enrollment pages confirmed membership. The Pixel was switched to the associated
account, but its listing still showed the older release after a Play Store restart.
Another launch returned to the same Play prompt; "Update from Play" did not
complete an installation. The web Play installer disabled the Pixel target because
it already had the app installed. These attempts did not establish a healthy
final-binary launch or Play installation.

### Physical Google Play installation and cold launch

The owner then explicitly approved uninstalling and reinstalling Dayova, including
loss of local app data and sign-in. Initial Play reinstalls still delivered code
23, including with the enrolled work account selected; code 23 opened normally.
Play Console was rechecked: internal release 3 contained code 25, was available
to internal testers, and had deactivated code 23 with no retained bundles.
After clearing only the Play Store's temporary cache (not its user storage) and
restarting Play, the phone identified the user as an internal tester and offered
the September 16 update. This sequence resolved delivery; it does not prove that
cache state was the sole cause of the earlier mismatch.

The update completed at 23:19:22 Europe/Berlin on September 16. Android package
metadata reports `com.dayova`, version 1.0.5, code 25, and installer
`com.android.vending` on the Pixel 9 / API 37. The installed split package's
`base.apk` was pulled for inspection; SHA-256:
`46a71c664bf0ecf43db97f55d242fa61e95999257be26411dc001a992708903d`.
Its embedded manifest and JavaScript bundle are byte-identical to the verified
Play universal APK and submitted AAB. Their respective SHA-256 values are
`8612598e44c6f2425a2c254722358799822df4faef76f9beff2e8ab4385c3a02`
and `c5a8ade91d275fe2cec66d7242d2b441fbb91dd6e94fa9ffc49ea1bf3976e0d8`.
The installed manifest identifies embedded UUID
`24f4a03e-9a27-41b9-817c-da3a2d8335e8`; the Android manifest/resources confirm
production channel, runtime 1.0.5, updates enabled, ALWAYS check and zero wait.

The app rendered its normal welcome screen, remained open online for more than
30 seconds, and rendered the same screen after force-stop and relaunch. Both
the accessibility tree and screenshot show the Dayova welcome text and
Registration/Login controls, with no Play-license prompt. This verifies the
exact production binary's Play installation and initial/cold launch; it is not
authenticated-flow QA or proof of a newly published production OTA. The embedded
UUID above comes from artifact inspection, not an in-app running-UUID readout.

## Existing same-runtime Android audience

Google Play already distributes Android 1.0.5 (23), which will also be eligible
for production/runtime 1.0.5 OTAs. Its compatibility cannot be inferred from the
version string alone.

The earlier signed AAB comparison of 23 with production 24 found no added or
removed entries: all 100 native libraries and all resources matched byte for
byte. Seven DEX files matched except the generated VERSION_CODE 23 to 24 and
associated checksum/signature; the Android binary manifest changed only its
version code. The other changed entries were bundled JavaScript/update manifest,
the baseline profile and package signatures. Final build 25 was compared with 23 too: no added or removed entries, all 100 native
libraries and resources match, and six of seven DEX files match exactly. The
remaining DEX differs only in its 24-byte checksum/signature and one generated
VERSION_CODE byte (23 to 25, confirmed by dexdump). The protobuf AndroidManifest
diff is only the textual and encoded version code. Package signatures, bundled
JavaScript/update manifest and baseline.prof also differ. This supports native
compatibility of the existing production/runtime 1.0.5 Android audience.

Older iOS builds 55/70/71/72 request production/runtime 1.0.4 and cannot receive
the new 1.0.5 update. Their fingerprints differ; do not publish a 1.0.4 maintenance
update based solely on build 72.

## Staging evidence

Both-platform staging group: `3e5b72da-d538-4719-9a07-93102284d754`, runtime
1.0.5, source `4e01f2c80a4672aca23c1c8af2413d4931e55348`, isolated channel and
branch `ota-staging`.

| Platform | Staging binary | OTA UUID |
| --- | --- | --- |
| iOS | TestFlight 1.0.5 (74), build `da842dcd-12c8-4500-9404-3ee41488c882` | `01a0ab41-c60c-73b0-b79a-11434bf63f18` |
| Android | APK 1.0.5 (24), build `33c5be4c-5ee0-4249-8f0d-99900df3fd3c` | `01a0ab41-c60c-742d-9b2d-96ac81b6dd18` |

Android's isolated API-34 emulator recorded DownloadComplete for the exact OTA
UUID and then rendered the normal welcome screen after a further cold restart.
The owner reports that the TestFlight app functions normally, in response to the
requested install/open/wait/cold-restart check. At 19:12 UTC, EAS reported one
unique user, one `installs` and zero `failedInstalls` on each platform; channel
insights also listed this group for both platforms.

These aggregate counters corroborate delivery but are not independent proof of
the current update UUID on a particular device. The `installs` counter can
reflect manifest/launch-asset download, and running/failure reports may lag until
a subsequent update check. Keep the native download logs, owner-reported app
behavior and aggregate metrics distinct; do not describe the counter alone as
a verified launch.

### Direct running-update verification

Read-only diagnostics were published to ota-staging in group
`dcaab26e-cadd-4457-9850-ae328917be57`, source
`d40ba781b5fedeaed4451543c320dbcc79593d06`. After download and another cold
restart, the isolated API-34 Android emulator showed build 24, channel ota-staging,
runtime 1.0.5, source OTA, running UUID
`01a0abc2-d336-746f-883d-5cfdc78f830b`, and emergency launch Nein. This is
direct running-state evidence rather than an aggregate download counter.
On September 17, the owner's physical iPhone photo directly showed version
1.0.5, build 74, channel ota-staging, runtime 1.0.5, source OTA, running UUID
`01a0abc2-d336-76de-8b56-634344dfef38`, and emergency launch Nein. The owner
reported following the requested online wait and full close/reopen procedure.
The still photo proves the displayed running state; restart timing is
owner-reported. Photo SHA-256:
`47db5b8d05309fb4ae89b28a97a1a9cafd28f49d624637fdd3665ca877fdd25a`.
Both platforms therefore have direct running-update identity evidence for that
staging group. This proves the OTA delivery/launch path, not a staging check of
the later integrated activation source. The latter includes subsequent main
changes to authentication, subscriptions, learning plans and timetable/entry
flows. Publish and verify the final candidate in staging before activation.

## Signing and distribution

The downloaded iOS 73, 74 and 75 IPAs use the same App Store provisioning profile
`51ac3097-ef89-4567-b1ad-aacd1303d421`, team `F34RK39TRV`, identifier
`de.dayova.app`, and distribution certificate. Profile and certificate expire
11 May 2027. Build 75 embeds that same profile; no new signing credential was created. TestFlight
uses store signing; direct ad-hoc installation would require a suitable separate
profile listing the test devices.

Final iOS 75 is intended for internal TestFlight first; final Android 25 is
intended for Google Play internal testing first. Neither a staging binary nor
an uninstalled production candidate satisfies the distribution baseline.

The diagnostic implementation is merged as
[PR #637](https://github.com/Dayova/dayova-mvp/pull/637), merge
`d95bc0ee789c194912be8bce819bb267bee151bc`. The final sheet uses the supported
scrollable medium size; the recorded staging group above predates that sizing-only
adjustment. Its update-identification logic is unchanged. The merged-source
[workflow](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a0abcd-4e26-7367-a1ff-36e8761c41ed)
produced the same iOS and Android native fingerprints as final builds 75/25.
The eventual activation commit still needs its own workflow check.

## Prepared activation

[The schema-2 baseline](./production-ota-baseline.json) records both exact
artifacts and verified distribution evidence. The historical schema-1 baseline
is retained in a test fixture so its rejection remains covered. This branch
does not publish updates: before merging it, run the manual `ota-preflight.yml`
workflow against its exact remote commit. That workflow generates production
CNG fingerprints, compares them to the distributed binaries, and exports both
platforms without deploying Convex or publishing an OTA. Any mismatch blocks
activation unless an exact, separately audited native-equivalence record covers
the mismatch; recorded build fingerprints must never be relabelled.

### Final-source preflight blocker — September 17

The [manual preflight](https://expo.dev/accounts/dayova/projects/dayova/workflows/01a0ac47-b870-7022-b2b4-d03713bdb87e)
ran against exact remote source `2700b541066c6cf50a27db25e54ca015d4564a2f`.
Its production CNG fingerprint job succeeded, returning iOS
`f92f0379d721a5c3c2bcee935878412d7d559857` and Android
`df6aacec11591f424f52decf30d1522c3fe90820`. These differ from the recorded
75/25 binaries, so the guard correctly failed before either export. Successful
fingerprint generation is not a successful compatibility check.

EAS fingerprint comparisons against both build fingerprints identified exactly
two changed inputs on each platform, with no added or removed source entries:

| Input | Build 75/25 input hash | Integrated-source input hash |
| --- | --- | --- |
| `.gitignore` | `75a431a2e9fb65f762fcb8a513125f435b273242` | `2bdbd5b2d579fed0d3b79b5b863bc2f64ef01197` |
| `packageJson:scripts` | `d6b49aa9f36af0b0b2c1e8a3a151bc19e6096aa1` | `a96ea426284d7d7a9652490d73b6aee985515086` |

The corresponding Git diff adds only the Maestro artifact ignore entry and two
Maestro smoke-test commands. Other fingerprint source hashes are unchanged.
This narrows the mismatch to test tooling inputs; it does not authorize replacing
the stored build hashes or bypassing the exact-match guard. Resolve this
compatibility blocker and validate the final candidate in staging before merge.
No replacement binary or production OTA was issued for this mismatch.

### Reviewed native equivalence

The source comparison above was independently reviewed. The `.gitignore` delta
adds only `/.maestro/artifacts/`; `packageJson:scripts` adds only
`test:smoke:android` and `test:smoke:ios`. These developer-invoked Maestro commands
are not install/build hooks. No native dependency, autolinking/configuration,
plugin, asset, patch or other fingerprint source hash changes. Building new store
binaries solely for these two tooling inputs would not exercise different native
code.

Each platform therefore records its exact current CNG hash as a reviewed
compatible fingerprint, bound to its unchanged original build hash and audit
source `2700b541066c6cf50a27db25e54ca015d4564a2f`. The guard accepts only these
specific hashes in addition to the originals, rejects malformed reviews, and
continues to reject every unlisted hash. This is a documented compatibility
decision, not a claim that the build and candidate hashes are identical. The
audit source records the comparison provenance; later JavaScript-only commits
may retain that same reviewed native hash. Final-source cloud validation and
integrated-candidate staging are still required before activation.

Local `pnpm check`, all 23 OTA safety tests and all 15 publication tests passed.
With the real production config, the guard accepts the recorded build hashes
and rejects deliberate mismatches on each platform. Those injected-hash checks
test guard behavior; the failed cloud preflight is the actual current-source
compatibility result.

## Activation and recovery

Complete the [release runbook](./README.md#when-automatic-production-ota-may-resume)
before replacing the active baseline. Record exact production artifact and
installation evidence, preserve same-runtime Android compatibility evidence,
and validate matching and deliberately mismatched fingerprints. The activation
merge itself can publish a both-platform production OTA after CI and Convex pass.

Before that first publication, recheck the channel mapping and rollback target.
The recorded production mapping exclusively targets branch production (channel
`019e9424-6df3-788a-a8ca-dc56f3deaa97`, branch
`019e9424-4b6a-738e-afea-811d2d85ce40`). The existing July 17 production group
`6469f3cd-078b-4d0a-b31a-f0b9c52e93ab` uses runtime 1.0.3 and is not a valid
1.0.5 rollback target. For the first 1.0.5 publication, the planned fallback is
the native embedded update for that runtime, after each final binary passes
installation/health checks. The exact final embedded UUIDs are recorded above;
older same-runtime Android 23 falls back to its own embedded update
`eb200c18-56a2-40f3-8bbe-4849b566c148`. Verify state compatibility before issuing
a roll-back-to-embedded directive; no recovery action has been executed.
The production publisher's reserved `production-publication-lock` branch must
remain empty and unmapped. Any uncertain publication leaves it in place; stop
all publishers and inspect actual server state before recovery or removal.

Operational updates: [DAY-248](https://linear.app/dayova/issue/DAY-248).
