# Primary sources used for the Google Play audit

Original audit references: 2026-08-25. The subset rechecked on September 16 is
listed separately below; this file does not imply every source was re-audited.

- [Create and set up an app — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Add preview assets to showcase your app — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/9866151)
- [User Data policy: account deletion requirements — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Manage target audience and app content settings](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Payments policy — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Add developer-account users and manage permissions — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/9844686) — distinguishes account owner from administrators and reserves Play Console's Payments settings page for the owner.
- [Manage users in your payments profile — Google Payments Center Help](https://support.google.com/paymentscenter/answer/7162853) — documents Payments Center admin and primary-contact access independently from Play Console ownership.
- [Target API level requirements for Google Play apps](https://support.google.com/googleplay/android-developer/answer/11926878)
- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465) — applies to Personal accounts created after 13 November 2023; Dayova's verified Organization account is outside this rule.
- [Set up an open, closed, or internal test — Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/9845334) — tester audiences, opt-in links, simultaneous tests, and highest-version-code eligibility.
- [Build and test your Android App Bundle — Android Developers](https://developer.android.com/guide/app-bundle/test) — recommends progressing from Closed to Open and identifies the initial Closed track as Alpha.
- [Submit to the Google Play Store — Expo documentation](https://docs.expo.dev/submit/android/)
- [Automate submissions — Expo documentation](https://docs.expo.dev/build/automate-submissions/) — maps EAS `alpha` to Closed and `beta` to Open testing and requires `completed` for automatic track release.
- [EAS Workflows syntax — Expo documentation](https://docs.expo.dev/eas/workflows/syntax/) — manual inputs, build/submit outputs, and approval gates used by the Android test workflow.
- [Manual Android submission — Expo documentation](https://docs.expo.dev/submit/android-manual/)
- [Expo SDK 57 reference and Android target SDK table](https://docs.expo.dev/versions/v57.0.0/)
- [Google Play Data safety — RevenueCat documentation](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety)

## Reconciliation sources — 16 September 2026

- [Expo rollback guide](https://docs.expo.dev/eas-update/rollbacks/) and local
  `eas-cli@18.11.0` help for `update:rollback`, `update:republish`, and
  `update:roll-back-to-embedded`: verified command names and supported arguments.
- [Google testing guidance](https://support.google.com/googleplay/android-developer/answer/9845334)
  and [publishing states](https://support.google.com/googleplay/android-developer/answer/9859751):
  submission/approval does not guarantee immediate tester availability.
- [Live Dayova privacy policy](https://dayova.com/privacy): app-inclusive scope,
  Vertex AI/R2 processing, and remaining release-behavior reconciliation.
- [DAY-216](https://linear.app/dayova/issue/DAY-216): historical production GeoIP
  ingestion and unresolved verification; not a new production traffic audit.
- [DAY-248](https://linear.app/dayova/issue/DAY-248): owner-reported store
  availability and exact native-release reconciliation.
- [DAY-414](https://linear.app/dayova/issue/DAY-414): both-platform exports and
  guarded publication required before production baseline activation.
- Authenticated EAS `build:view` for Android build
  `b8c2cdc4-076f-4569-90e2-6135fdb4bbe8`: metadata fields and verification limits
  are recorded in the [candidate audit](./release-candidate-audit.md).

Console wording and policy requirements can change. Reopen these sources while
completing the live forms rather than treating this dated pack as a substitute
for the current Console prompts.
