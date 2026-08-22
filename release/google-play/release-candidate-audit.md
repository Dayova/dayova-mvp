# Android release-candidate audit

Audited: 2026-08-22

## Current source

| Item | Value |
| --- | --- |
| Repository revision audited | `4455dd25324542ba20700170923987bb63d4900f` |
| Expo/EAS project | account `dayova`, project `d3d06b26-c8da-4192-a50d-e1bb0ca4902c` |
| Android application ID | `com.dayova` |
| Configured app/runtime version | `1.0.3` |
| Expo SDK | 57 |
| Android target/compile SDK | 36 |
| Current EAS remote Android version code | 19 |
| Production build behavior | EAS production profile auto-increments the version code and uses channel/environment `production` |

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

## Version decision

Recommended release boundary: **1.0.5**, with the next EAS-generated Android
version code expected to be **20**.

Why not reuse 1.0.4:

- A successful Android 1.0.4/build 15 already exists on the production channel.
- Production EAS Updates are shared by runtime/channel compatibility, not by
  whether an old build was ultimately chosen for Play production.
- Reusing runtime 1.0.4 for a new native-subscription binary could allow an OTA
  intended for the new native surface to reach build 15.

Setting app/runtime version 1.0.5 creates a clean native compatibility boundary.
It also means Android may launch as 1.0.5 while the Apple review currently shows
1.0.3; that is technically valid, but future iOS versions must move forward and
must not regress to a lower public version.

`DECISION REQUIRED`: an authorized release owner must approve 1.0.5 before the
config is changed and the paid EAS build is started.

## Environment/build blockers

- Production EAS has no `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
- The production legal/cancellation URLs are Apple-specific and require an
  Android/app-policy pass.
- No current-source Android build exists.
- The local installed development build could not render the current source:
  native React Native Worklets was 0.8.3 while JavaScript was 0.10.0. The app
  therefore showed a blank screen and was not used for screenshots.
- The website repo contains older iPhone-framed marketing images; they are not
  truthful Android screenshots and were not repurposed.

## Evidence to capture for the new candidate

Record in DAY-218 and here (or in the OTA baseline once actually distributed):

- EAS build ID and artifact URL
- version name and version code
- exact source SHA
- runtime version
- EAS native fingerprint
- full AAB SHA-256 and byte size
- Play internal-test release/track ID
- install evidence from Play, device/Android version, tester, and test timestamp
- purchase/restore/expiry and deletion evidence
- screenshot source build ID
