# Android release-candidate audit

Audited: 2026-08-23

## Current source

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

## Actual submitted release boundary

The release owner kept app/runtime version **1.0.3** and submitted version code
**20**. This supersedes the earlier 1.0.5 recommendation. The exact submitted
artifact is EAS build `1b52de89-746d-4600-9670-7c395079ff02`, built from
`31f7f25787d2c4cdfde96384379f47b3e321fc17`, and connected to Play by submission
`d3e7d523-cac4-4be9-a55c-2245d1095972`.

Do not treat later documentation commits as artifact source. Production OTA
eligibility remains blocked until the public Play distribution is verified and
the Android baseline records this exact native build and fingerprint.

## Environment and review state

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

Record in DAY-218 and the OTA baseline once actually distributed:

- public approval/availability timestamp and public listing install evidence
- exact distributed version name and version code
- exact source SHA (`31f7f25787d2c4cdfde96384379f47b3e321fc17`) and EAS
  build ID
- runtime version
- EAS native fingerprint
- full AAB SHA-256 and byte size
- Play production release/track ID (`4697718440238285251`)
- install evidence from the public Play listing, device/Android version, tester,
  and test timestamp
- purchase/restore/expiry and deletion evidence
- screenshot source build ID
