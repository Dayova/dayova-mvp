# Android release-candidate audit

Reconciled: 2026-09-11 from the 2026-09-07 build and submission evidence in
[PR #545](https://github.com/Dayova/dayova-mvp/pull/545). No new live Console or
artifact audit is claimed by this documentation update.

## Current Android candidate — 1.0.5 / build 23

| Item | Value |
| --- | --- |
| EAS build | [b8c2cdc4-076f-4569-90e2-6135fdb4bbe8](https://expo.dev/accounts/dayova/projects/dayova/builds/b8c2cdc4-076f-4569-90e2-6135fdb4bbe8) |
| Signed AAB | [Download build 23](https://expo.dev/artifacts/eas/GbKrNvAqS0DeaLHn7TzUth8xiIGSCaHhzvMbrBTEXd8.aab) |
| Source SHA | `f1aff0f53708ca45b884100a8693a0209b983e2a` |
| App / runtime / version code | `1.0.5` / `1.0.5` / `23` |
| Expo / React Native / Hermes V1 | `57.0.20` / `0.86.3` / `250829098.0.17` |
| Package / channel / target SDK | `com.dayova` / `production` / `36` |
| Native fingerprint | `63bf25dc5c63084519d6bd3c8e35439be0357a7e` |
| Embedded update ID | `eb200c18-56a2-40f3-8bbe-4849b566c148` |
| Build completed | `2026-09-07T19:03:15.395Z` |
| AAB size | `89,096,505` bytes |
| AAB SHA-256 | `433C18CA2083FB96598C60098704D44C0ECF506A7BC439CF21884495FCA2DCA7` |
| EAS submission | [74999aaa-d7a9-4cda-b83a-e97e965066b7](https://expo.dev/accounts/dayova/projects/dayova/submissions/74999aaa-d7a9-4cda-b83a-e97e965066b7), finished successfully on 2026-09-07 |

The recorded audit passed Bundletool validation and manifest/resource
inspection. Jarsigner verified the signature and the upload certificate matched
the prior Android artifact. The runtime was verified from the native resource
and embedded app config; the legacy embedded manifest supplied the update ID.

The PR records frozen installation, lint/typecheck, Expo Doctor 21/21, 715 Vitest
tests, 204 Jest UI tests, 17 Node script tests, Android/iOS production exports,
and cloud PR CI passing for the build source above.

At submission confirmation on September 7, Play Console showed build 23
available to Internal testers. The same bundle was promoted to Closed Alpha
and Open testing and replaced the unfinished Production 1.0.4/code-21 draft.
Production, Open testing, and Closed Alpha full rollouts plus resuming Open
testing were sent for review. All three rollout percentages were 100%; Germany
targeting was preserved and Managed publishing was off. Automated quick checks
were still running. Play validation had no blocking errors and one missing
deobfuscation-file warning; native debug symbols were attached.

Recheck Console before further release actions. Approval, public availability,
and Play install/billing QA were not verified by this submission record. Do not
repeat the upload or promote an older build to finish this handoff. Keep the
OTA baseline unchanged until both exact replacement binaries satisfy the
[baseline requirements](../README.md). No OTA was published.

## Historical source — audited 26 August 2026

The remaining August records preserve provenance only. They do not identify the
current candidate or authorize resuming an old submission sequence.

| Item | Value |
| --- | --- |
| Production build source | `31f7f25787d2c4cdfde96384379f47b3e321fc17` |
| Expo/EAS project | account `dayova`, project `d3d06b26-c8da-4192-a50d-e1bb0ca4902c` |
| Android application ID | `com.dayova` |
| Configured app/runtime version | `1.0.3` |
| Expo SDK | 57 |
| Android target/compile SDK | 36 |
| Submitted Android version code | 20 |
| Production build behavior | EAS production profile auto-increments the version code and uses channel/environment `production` |
| EAS build ID | `1b52de89-746d-4600-9670-7c395079ff02` |
| EAS submission ID | `d3e7d523-cac4-4be9-a55c-2245d1095972` |
| Play release | `1.0.3 – Erste Play-Store-Version` |
| Play status | Production, Germany, **In review**; Managed publishing off |
| Native fingerprint | `bbcbaae5c8ae69231aa15692d7197e4e87f61cac` |

Expo SDK 57 satisfies Android API level 36. Google requires new apps and app
updates to target API 36 from 2026-08-31; cutting the candidate on SDK 57 avoids
shipping immediately below that deadline.

## Existing Android AAB — evidence only

| Item | Value |
| --- | --- |
| EAS build ID | `6b0f77ea-6495-4993-a752-4e40a2f3ba5c` |
| Version / version code | `1.0.4` / `15` |
| Source revision | `82c1ff3636f17c414ced684cc404f9cb99e9b854` |
| Runtime version | `1.0.4` |
| Native fingerprint | `5ef78927851c64a594017079ad8e526c261d44ec` |
| AAB size | 90,058,208 bytes |
| SHA-256 | `96CA22DD496049EB3D4F9858B4153324336E50B0899288B5CB09DB0699BE2BC7` |
| Local path | `release/google-play/artifacts/dayova-1.0.4-build15-not-production-candidate.aab` (ignored by Git) |

**Do not submit this AAB as the first production candidate.** It predates the
audited source and current native subscription implementation. Its existence is
useful for provenance only.

## Historical submitted boundary reconciliation

The release owner submitted app/runtime **1.0.3**, version code **20**. The exact
artifact is EAS build `1b52de89-746d-4600-9670-7c395079ff02`, built from
`31f7f25787d2c4cdfde96384379f47b3e321fc17`, fingerprint
`bbcbaae5c8ae69231aa15692d7197e4e87f61cac`, and connected to Play by submission
`d3e7d523-cac4-4be9-a55c-2245d1095972`.

Build 20 shared runtime `1.0.3` with already distributed SDK 56 binaries and
was rejected as the DAY-248 baseline candidate. The August audit called for a
replacement at runtime `1.0.4`, which became build 21 below. Both Android builds
are now superseded by build 23; neither is the new verified OTA baseline.

## Historical replacement — 1.0.4 / build 21

| Item | Value |
| --- | --- |
| EAS build ID | `6df6e426-b361-46b5-8a17-a28f5be6d9ea` |
| Version / version code | `1.0.4` / `21` |
| Source revision | `1e3ee7d1efc5ac979fb509adb20654c95b879c15` |
| Runtime version | `1.0.4` |
| Expo SDK / channel | 57 / `production` |
| Android application ID | `com.dayova` |
| Native fingerprint | `8900552bda373cf9e678669a17c6f0dded5f755e` |
| Embedded update ID | `c782fa10-3626-4aa3-b072-921580c9c31b` |
| Embedded runtime / channel | `1.0.4` / `production` |
| AAB size | 89,202,561 bytes |
| SHA-256 | `58BDE082DE86C20DA05ADB9A04F1C94CA52E7FECCDA3A0414A695B5FB4E96CB9` |
| Local path | `release/google-play/artifacts/dayova-1.0.4-build21.aab` (ignored by Git) |

EAS finished this clean production-profile build on 2026-08-26. Bundletool
inspection of the signed AAB confirmed package `com.dayova`, version `1.0.4`,
version code `21`, the production update header, and resource runtime `1.0.4`.
It was built but not submitted at that audit. The September 7 submission record
confirms that the unfinished Production build-21 draft was replaced with build
23. Keep this artifact as historical evidence only.

The August Apple submission used the then-intended 1.0.4 boundary: iOS EAS build
`a218ee2f-29f1-4873-9b49-36b52625cb71`, app/runtime `1.0.4`, build `55`, source
`82c1ff3636f17c414ced684cc404f9cb99e9b854`, fingerprint
`78a442f2623d4417068794025c4d669bc9105be9`, submission
`85aa2c51-c562-485d-b28b-ff53e89ae9af`.

## Historical environment and review state — 26 August 2026

- Production EAS has the Android and iOS RevenueCat public SDK keys.
- Production Convex has the RevenueCat server key; old/exposed temporary keys
  were rotated or revoked and are not recorded here.
- Eight current Android screenshots from synthetic app data were uploaded. The
  website's older iPhone-framed artwork was not used as Android evidence.
- `pnpm check`, 635 Vitest tests, and 122 Jest UI tests passed before submission
  (757 tests total).
- Google Play automated quick checks passed. Missing R8/ProGuard deobfuscation
  mapping is a non-blocking warning for this review.
- Review is active. Managed publishing is off.
- Payments Center access was rechecked on 2026-08-23: the Dayova Organization
  profile is reachable by the release operator as **Admin, primary contact** and
  showed no alerts. Play Console's separate Payments profile page remains
  owner-only, so Julius must still confirm or resolve the previously reported
  Play payments-account action.
- Other open operational work: Play monthly/annual product and RevenueCat
  linkage verification; Play-signed billing lifecycle QA; and the separate
  privacy/account-deletion tasks.

## Evidence to capture for the new candidate

Record build-23 verification in DAY-218/DAY-248 after distribution. Update the
OTA baseline only when both platforms meet the [baseline requirements](../README.md):

- public approval/availability timestamp and public listing install evidence
- exact distributed version name and version code
- exact replacement source SHA and EAS build ID
- runtime version
- EAS native fingerprint
- full AAB SHA-256 and byte size
- Play production release/track ID (`4697718440238285251`)
- install evidence from the public Play listing, device/Android version, tester,
  and test timestamp
- purchase/restore/expiry and deletion evidence
- screenshot source build ID
