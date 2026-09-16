# Google Play Closed and Open testing runbook

Last reconciled: 2026-09-16 against the pinned EAS CLI, workflow, current Google
guidance, and [DAY-248](https://linear.app/dayova/issue/DAY-248). Store submission
history below is dated evidence, not a new Play Console inspection.

This runbook owns Dayova's repeatable Android tester-distribution path for the
existing Play app `com.dayova`. It does not create another Android application,
package, signing identity, or runtime. Closed, Open, and Production use the same
production EAS build profile and differ only in their Google Play release track.

## Track contract

| Dayova destination | EAS Submit profile | Google Play API track | Audience | Release behavior |
| --- | --- | --- | --- | --- |
| Internal testing | `internal` | `internal` | Up to 100 internal testers | Requests a completed release; normally available within minutes, subject to Play processing. |
| Closed testing | `closed` | `alpha` | Explicit email lists or Google Groups | Submits after workflow approval; availability depends on Google review, publishing state, and processing. |
| Open testing | `open` | `beta` | Anyone in the selected countries, optionally capped | Submits after workflow approval; availability depends on Google review, publishing state, and processing. |
| Production | `production` | `production` | Public production audience | Creates a draft; production rollout remains a separate Play Console decision. |

EAS submission success and `releaseStatus: completed` do not prove that testers
can install the release. Verify **Available** in Console and an actual opt-in
installation. See Google's [testing guidance](https://support.google.com/googleplay/android-developer/answer/9845334)
and [publishing states](https://support.google.com/googleplay/android-developer/answer/9859751).

The store build always uses EAS build profile `production`, which resolves
`APP_VARIANT=production`, package `com.dayova`, the production EAS environment,
the `production` update channel, and remote auto-incremented Android version
codes. Do not use `preview`, `apk-test`, or `com.dayova.dev` for a Play track.

## Current rollout gate

The recorded 2026-09-07 submission in
[PR #545](https://github.com/Dayova/dayova-mvp/pull/545): app/runtime `1.0.5`,
version code `23`, was available to Internal testers. The same bundle was
promoted to Closed Alpha and Open testing and replaced the Production
`1.0.4`/code-21 draft. Full rollouts on all three tracks plus resuming Open
testing were sent for review, preserving Germany targeting with Managed
publishing off.

The owner subsequently reported Google live on September 15, as recorded in
[DAY-248](https://linear.app/dayova/issue/DAY-248). Preserve that newer report;
do not describe the September 7 review state as today's status. Exact current
track availability and installed-build QA still need their own evidence.

Recheck Console for subsequent review/availability changes before acting. Run
install and billing QA on the exact build 23 identified in the
[candidate audit](./release-candidate-audit.md), and record the track, device,
and results. Public approval and successful Play install QA are not established
by the submission record.

The August build-20 testing drafts and build-21 replacement instructions are
superseded. Do not resume that withdrawal/replacement sequence or run the
new-candidate workflow below just to complete build-23 verification. Use that
workflow only for a separately approved future candidate.

## Create a new test candidate

Run the manual EAS Workflow from the exact Git revision approved for testing:

```sh
pnpm dlx eas-cli@18.11.0 workflow:run \
  .eas/workflows/android-play-test.yml \
  -F track=closed
```

Use `-F track=open` only when Open testing intentionally needs a newly built
candidate. The workflow:

1. runs `pnpm check` and `pnpm test`;
2. creates one production Android App Bundle with a new version code;
3. shows the EAS build ID, version, version code, and source commit;
4. pauses for an explicit human approval; and
5. submits the approved build with the matching `closed` or `open` EAS Submit
   profile.

Before approving, verify the destination, source SHA, version code, EAS
production environment, and `com.dayova` package. After submission, record the
EAS build/submission IDs and device results in
[DAY-218](https://linear.app/dayova/issue/DAY-218/set-up-google-play-console-and-complete-android-release-readiness).

## Preferred Closed-to-Open progression

Use Closed testing for the small trusted group first. When that exact artifact
passes the acceptance matrix, use Play Console's **Promote release** action to
add the same version code to Open testing. Promotion preserves the tested
artifact; running the Open workflow instead creates a new AAB and therefore a
new version code that needs its own validation.

Do not upload the same AAB again through EAS Submit just to change tracks. Use
Play Console promotion for the same artifact, or build a genuinely new Open
candidate with the workflow.

## Tester eligibility and version-code rules

- A tester must be in the configured audience and must opt in through the Play
  link before receiving Closed testing.
- Internal testers are not eligible for Closed or Open testing until they opt
  out of Internal testing and opt into the intended track.
- A user eligible for multiple non-internal tracks receives the compatible build
  with the highest version code. Keep Closed, Open, and Production version codes
  intentional so one track does not silently shadow another.
- Closed testing is not discoverable before an Open or Production listing is
  public. Share the Console-provided opt-in link directly.
- Open testing makes the test program visible on Google Play. Confirm listing,
  countries, audience cap, support channel, policy state, and reviewer access
  before activating it.

## One-time Play Console setup

The EAS workflow can upload and publish releases, but it cannot choose Dayova's
tester identities or public audience. A Play Console administrator must:

1. open **Test and release → Testing → Closed testing**, manage the default
   closed track, and configure the Dayova tester email list or Google Group;
2. add a feedback email or URL, save the audience, and copy the Closed testing
   opt-in link;
3. open **Open testing**, select Germany (and only later any separately approved
   countries), choose an optional tester cap, and confirm the public listing and
   feedback channel;
4. verify the Google service account used by EAS Submit still has only the
   required app/release permissions; and
5. after each release, verify its Play status is available, install through the
   opt-in link on a non-team account, and record the exact version code and test
   evidence in DAY-218.

Never commit the service-account JSON, tester email addresses, reviewer
credentials, keystores, or opt-in access data. Store only the operational
evidence and links in their approved systems.
