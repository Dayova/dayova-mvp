# Google Play Data safety draft

Engineering inventory reconciled: 2026-09-16 against the PR #545 source, the live
privacy policy, and Linear evidence. Submitted Console answers remain August
history; no new Console inspection or production traffic audit is claimed.

This is a conservative engineering inventory for the Play Console form. It is
**not legal approval**. Product/legal must reconcile it with the final privacy
policy, processor contracts, retention schedule, target audience, and the exact
release build for the current review and every future update.

The Data safety and related deletion declarations were submitted to Google in
the recorded August review. That submission is not evidence that the policy, public
deletion resource, in-app deletion flow, or downstream deletion behavior is
complete. DAY-217/DAY-183 and their child tasks remain open.

The [live privacy policy](https://dayova.com/privacy), checked September 16, now
explicitly covers the mobile app, Vertex AI, R2, analytics, and subscriptions.
It is no longer website-only. Reconcile the remaining discrepancies under
DAY-217/DAY-359: its payment section describes iOS/web but omits Android billing,
and its voice-permission description must match the release's removed voice
features. Publication alone does not verify consent, retention, or deletion.

## Top-level answers

| Question | Draft answer | Status / evidence needed |
| --- | --- | --- |
| Does the app collect or share required user-data types? | Yes — it collects account, learner, content, purchase, and analytics data. | Confirm against production processors and the Play-delivered build. |
| Is all collected user data encrypted in transit? | `PENDING` — expected Yes from the HTTPS/TLS service architecture, but not yet fully evidenced. | `CONFIRM` the final production AAB and every Clerk, Convex, PostHog, RevenueCat, upload, and other SDK traffic path before treating Yes as verified. |
| Can users request deletion? | A Console answer was submitted, but compliant end-to-end release evidence is still missing. | DAY-183/DAY-360/DAY-362/DAY-363 require the public URL, in-app route, complete pipeline, and Play-delivered QA. |
| Does the app show ads or use data for advertising? | No. | Confirm no release dependency introduces ads/ad attribution. |
| Is data sold? | No. | Legal confirmation required. |
| Is data “shared” with third parties under Google's definition? | `PENDING` reconciliation for every service below, including Vertex AI and R2. | `CONFIRM` DPAs, purposes, and Google policy exceptions. A service-provider transfer is not automatically “sharing”; adding a processor does not by itself establish a Yes answer. |

## Collected-data inventory

| Play category / type | Collected | Linked to user | Optional | Primary purpose | Engineering evidence / caveat |
| --- | --- | --- | --- | --- | --- |
| Personal info — Name | Yes | Yes | `CONFIRM` | Account management; app functionality | Stored in the Dayova user profile. |
| Personal info — Email address | Yes | Yes | No | Account management; authentication; support | Clerk identity and Dayova user record. |
| Personal info — User IDs | Yes | Yes | No | Authentication; app functionality; analytics; subscriptions | Clerk ID is used across the app and as the identified PostHog distinct ID; RevenueCat uses an app user ID. |
| Personal info — Phone number | Possible | Yes | `CONFIRM` | Account/profile functionality | Supported by the user schema. Confirm whether the production flow actually requests it. |
| Personal info — Other info | Yes | Yes | `CONFIRM` | Personalization; app functionality | Date of birth, grade, school type, and German state can be stored. Exact required/optional status depends on onboarding. |
| Financial info — Purchase history | Yes | Yes | No | Subscription entitlement and account management | RevenueCat documents this collection as required and not user-disableable when its SDK is used. Do not declare payment-card details; the app does not handle them. |
| Photos and videos — Photos | Yes when uploaded | Yes | Yes | App functionality | Learners can upload photographed school material. Confirm whether video upload is supported; current evidence only supports photos. |
| Files and docs — Files and docs | Yes when uploaded | Yes | Yes | App functionality | Uploaded worksheets, class notes, and other school material. |
| App activity — App interactions | Yes | Yes | No while analytics is enabled | Analytics; app functionality | PostHog is initialized with an identified Clerk user. Autocapture, lifecycle capture, and session replay are disabled, but custom product events are linked. |
| App activity — Other user-generated content | Yes | Yes | Feature-dependent | App functionality; personalization | Notes, open answers, learning-session responses/transcripts, plan inputs, schedules, and related learner content. |
| Device or other IDs | Likely | `CONFIRM` | No while relevant SDKs run | Authentication; analytics; subscriptions | SDK installation/session identifiers may qualify. Verify Clerk, PostHog, and RevenueCat release configurations before selecting the form answer. |
| Location — IP-derived, precision to verify | Historical production ingestion recorded; current configuration `CONFIRM` | Identified PostHog profiles were involved | `CONFIRM` | Purpose requires approval | [DAY-216](https://linear.app/dayova/issue/DAY-216) records ingested GeoIP city, postcode, and coordinate properties. Inspect server-side enrichment and retention; Android location permissions alone cannot establish absence. |

DAY-216 remains unresolved. Its recorded ingestion is not proof of today's
collection rate or of every profile containing those values. Verify production
settings and a controlled event, then classify location under
[Google's Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469).

No repository evidence was found for collecting device contacts, device calendar
data, health/fitness data, audio recordings, SMS/messages,
web-browsing history, payment-card/bank details, advertising IDs, or data used
for ads. Re-check the final Android dependency report and manifest before
declaring those categories absent.

## Processor map

| Service | Data/purpose in the app | Declaration note |
| --- | --- | --- |
| Clerk | Authentication, account identifiers, account profile | Must be covered by the app privacy policy and deletion process. |
| Convex | Dayova profiles, plans, uploads, answers, schedules, notifications, entitlement state | Primary app backend. Retention and deletion coverage are unresolved. |
| Cloudflare R2 | Uploaded materials and timetable files; the default configured upload provider, with Convex storage also supported | Verify the deployed provider, access controls, retention, and file deletion. See [storage selection](../../convex/fileStorage.ts) and [timetable uploads](../../convex/timetables.ts). |
| Google Cloud Vertex AI | Uploaded material/timetable content, learning context, and written learner answers used for generation and evaluation | Reconcile AI consent, processing purposes, contracts, retention, and deletion. See [learning AI](../../convex/learningPlanAi.ts) and [timetable extraction](../../convex/timetableAi.ts). |
| PostHog | Identified product-interaction events; recorded GeoIP enrichment under DAY-216 | Product interactions should be declared linked unless implementation changes. No user opt-out was found; verify server-side geography and IP settings separately. |
| RevenueCat | App user ID, purchase history, subscription entitlement | RevenueCat's Google guidance treats purchase history as collected for app functionality and analytics. |
| Google Play Billing | Purchase and subscription processing | Dayova should not claim it collects users' payment-card details. |

## Required reconciliation before clicking Save

1. Reconcile the published app policy with all processors and actual release
   behavior, including Android billing, AI processing, GeoIP, permissions,
   retention, children's-data position, user rights, and account deletion.
2. Implement and verify account deletion across Clerk, Convex, files/uploads,
   analytics identifiers, entitlement mappings, and all sessions, while stating
   any legally required retention.
3. Confirm the final PostHog configuration, DAY-216's GeoIP/IP decision, and
   whether analytics remains linked and mandatory.
4. Confirm the final SDK/manifest data behavior with the production AAB.
5. Make the final target-age/Families decision before reconciling child-data
   requirements.
