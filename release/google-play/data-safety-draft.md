# Google Play Data safety draft

Last audited against the repository and submitted Console state: 2026-08-23

This is a conservative engineering inventory for the Play Console form. It is
**not legal approval**. Product/legal must reconcile it with the final privacy
policy, processor contracts, retention schedule, target audience, and the exact
release build for the current review and every future update.

The Data safety and related deletion declarations were submitted to Google and
are in review. That submission is not evidence that the website policy, public
deletion resource, in-app deletion flow, or downstream deletion behavior is
complete. DAY-217/DAY-183 and their child tasks remain open.

## Top-level answers

| Question | Draft answer | Status / evidence needed |
| --- | --- | --- |
| Does the app collect or share required user-data types? | Yes — it collects account, learner, content, purchase, and analytics data. | Confirm against production processors and the Play-delivered build. |
| Is all collected user data encrypted in transit? | Yes, based on HTTPS/TLS services used by the app. | `CONFIRM` with infrastructure/processor evidence. |
| Can users request deletion? | A Console answer was submitted, but compliant end-to-end release evidence is still missing. | DAY-183/DAY-360/DAY-362/DAY-363 require the public URL, in-app route, complete pipeline, and Play-delivered QA. |
| Does the app show ads or use data for advertising? | No. | Confirm no release dependency introduces ads/ad attribution. |
| Is data sold? | No. | Legal confirmation required. |
| Is data “shared” with third parties under Google's definition? | Draft **No** where Clerk, Convex, PostHog, and RevenueCat act only as service providers on Dayova's behalf. | `CONFIRM` DPAs, purposes, and Google policy exceptions. A service-provider transfer is not automatically “sharing.” |

## Collected-data inventory

| Play category / type | Collected | Linked to user | Optional | Primary purpose | Engineering evidence / caveat |
| --- | --- | --- | --- | --- | --- |
| Personal info — Name | Yes | Yes | `CONFIRM` | Account management; app functionality | Stored in the Dayova user profile. |
| Personal info — Email address | Yes | Yes | No | Account management; authentication; support | Clerk identity and Dayova user record. |
| Personal info — User IDs | Yes | Yes | No | Authentication; app functionality; analytics; subscriptions | Clerk ID is used across the app and as the identified PostHog distinct ID; RevenueCat uses an app user ID. |
| Personal info — Phone number | Possible | Yes | `CONFIRM` | Account/profile functionality | Supported by the user schema. Confirm whether the production flow actually requests it. |
| Personal info — Other info | Yes | Yes | `CONFIRM` | Personalization; app functionality | Date of birth, grade, school type, and German state can be stored. Exact required/optional status depends on onboarding. |
| Financial info — Purchase history | Yes | Yes | Yes until purchase | Subscription entitlement and account management | Google Play/RevenueCat purchase and entitlement state. Do not declare payment-card details; the app does not handle them. |
| Photos and videos — Photos | Yes when uploaded | Yes | Yes | App functionality | Learners can upload photographed school material. Confirm whether video upload is supported; current evidence only supports photos. |
| Files and docs — Files and docs | Yes when uploaded | Yes | Yes | App functionality | Uploaded worksheets, class notes, and other school material. |
| App activity — App interactions | Yes | Yes | No while analytics is enabled | Analytics; app functionality | PostHog is initialized with an identified Clerk user. Autocapture, lifecycle capture, and session replay are disabled, but custom product events are linked. |
| App activity — Other user-generated content | Yes | Yes | Feature-dependent | App functionality; personalization | Notes, open answers, learning-session responses/transcripts, plan inputs, schedules, and related learner content. |
| Device or other IDs | Likely | `CONFIRM` | No while relevant SDKs run | Authentication; analytics; subscriptions | SDK installation/session identifiers may qualify. Verify Clerk, PostHog, and RevenueCat release configurations before selecting the form answer. |

No repository evidence was found for collecting precise/approximate location,
contacts, calendar data, health/fitness data, audio recordings, SMS/messages,
web-browsing history, payment-card/bank details, advertising IDs, or data used
for ads. Re-check the final Android dependency report and manifest before
declaring those categories absent.

## Processor map

| Service | Data/purpose in the app | Declaration note |
| --- | --- | --- |
| Clerk | Authentication, account identifiers, account profile | Must be covered by the app privacy policy and deletion process. |
| Convex | Dayova profiles, plans, uploads, answers, schedules, notifications, entitlement state | Primary app backend. Retention and deletion coverage are unresolved. |
| PostHog | Identified product-interaction events | Product interactions should be declared linked unless implementation changes. No user opt-out was found. |
| RevenueCat | App user ID, purchase history, subscription entitlement | RevenueCat's Google guidance treats purchase history as collected for app functionality and analytics. |
| Google Play Billing | Purchase and subscription processing | Dayova should not claim it collects users' payment-card details. |

## Required reconciliation before clicking Save

1. Publish an app-specific privacy policy that names the mobile processors,
   purposes, legal bases, retention, children's-data position, user rights,
   analytics behavior, subscription processing, and account deletion.
2. Implement and verify account deletion across Clerk, Convex, files/uploads,
   analytics identifiers, entitlement mappings, and all sessions, while stating
   any legally required retention.
3. Confirm the final PostHog configuration and whether analytics remains linked
   and mandatory.
4. Confirm the final SDK/manifest data behavior with the production AAB.
5. Make the final target-age/Families decision before reconciling child-data
   requirements.
