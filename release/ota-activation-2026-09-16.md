# Production OTA activation evidence - 16 September 2026

Status: iOS 75 is processed in App Store Connect; Android 25 is built and submitted to Google Play internal testing. Production OTA remains blocked
by the historical schema-1 baseline. Build completion, store availability,
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
Store-installation evidence remains required before either candidate becomes a
verified production baseline.

iOS 75 artifact SHA-256:
`a1aa27d94a5cd7f12220c5f039ce9544cb99941b389ce6c906f28e7b9753e51a`.
The downloaded IPA identifies `de.dayova.app`, version 1.0.5, production channel,
runtime 1.0.5, enabled updates with launch check ALWAYS and zero wait, and embedded
update `e7f68437-b01d-40ed-96c3-80ecbbcb40ec`. Its signing profile is the same
verified profile listed below. EAS submission
`006bc404-6af1-4ee7-bbdd-fd88da508532` resulted in App Store Connect build
`c929a73d-e3f0-43f1-b02e-6be122ec224f`, upload status Complete, assigned to
Team (Expo), four internal testers. This proves processing and availability,
not installation on a physical device.

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
to internal testers (16 September, 21:53 as displayed). The Play-generated universal
APK download was blocked by Edge with ERR_BLOCKED_BY_CLIENT; owner download and
installation verification remain pending.

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
The iOS counterpart is `01a0abc2-d336-76de-8b56-634344dfef38`; owner
confirmation from physical TestFlight build 74 is pending.

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

## Prepared baseline (inactive)

[The candidate JSON](./production-ota-baseline.candidate.json) records both exact
artifacts and leaves distribution unverified. It is not read by the production
guard. Do not copy it over the active baseline until the installation and
staging checks above are complete. Before activation, move the historical
schema-1 baseline into a test fixture so its rejection test remains meaningful,
and verify fingerprints from the final activation commit itself.

## Activation and recovery

Complete the [release runbook](./README.md#when-automatic-production-ota-may-resume)
before replacing the active baseline. Record exact production artifact and
installation evidence, preserve same-runtime Android compatibility evidence,
and validate matching and deliberately mismatched fingerprints. The activation
merge itself can publish a both-platform production OTA after CI and Convex pass.

Before that first publication, record the channel mapping and rollback target.
The production publisher's reserved `production-publication-lock` branch must
remain empty and unmapped. Any uncertain publication leaves it in place; stop
all publishers and inspect actual server state before recovery or removal.

Operational updates: [DAY-248](https://linear.app/dayova/issue/DAY-248).
