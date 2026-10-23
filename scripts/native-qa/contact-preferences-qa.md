# Native contact acceptance

Run the manual EAS workflow against a pushed revision:

```sh
EXPO_NO_DOTENV=1 APP_VARIANT=development eas workflow:run contact-preferences-qa.yml \
  --ref <commit-or-branch> --input platform=both --non-interactive
```

Supply compatible development-client build IDs with `ios_build_id` and
`android_build_id`. The workflow loads the selected revision's JavaScript through
Metro; the build IDs identify native containers, not the tested JavaScript.
The development EAS environment must contain the development Clerk publishable
key and the existing synthetic `MAESTRO_CI_EMAIL` / `MAESTRO_CI_PASSWORD` identity.
Never put credentials in workflow inputs or source files.

The runner requires a fresh checkout, development app ID, approved development
Clerk host, synthetic identity and loopback Convex URL. It starts a disposable
anonymous Convex backend inside the job and removes shared-deployment and CRM
credentials from child environments. It does not deploy to a shared backend.
Native journeys exercise optional onboarding, validation/keyboard behavior,
independent purposes, number replacement, save/relaunch persistence, withdrawal,
and large text in dark appearance. Real authenticated queries check saved state.
The native container is installed once per run; subsequent journeys explicitly
relaunch it without replacing the installation or clearing the session. The iOS
worker is pinned to Xcode 26.6 and configures Simulator.app's software keyboard
before boot, then separately asserts a visible numeric key before capturing the
focused phone input. Xcode 27's DeviceHub preference write timed out on EAS;
the pinned worker avoids that protected-container operation. The existing native
client's minimum iOS version is 16.4. Acceptance on this worker proves the tested
runtime, not iOS 27 compatibility.

Only sanitized diagnostics and selected screenshots under
`.maestro/artifacts/contact-qa/public` are uploaded. Private service logs stay on
the disposable worker. `acceptance.json` records the source revision, platform,
completed steps and failure; a partial run is not a pass. Inspect the screenshots
before claiming layout acceptance. This suite does not cover new-account
registration or manual VoiceOver/TalkBack audio traversal.

## New-account registration without a number

The separate manual workflow `contact-registration-qa.yml` accepts the same
platform/build inputs. It runs the real profile flow, skips contact details,
creates a unique development Clerk test-email account, verifies its code, waits
for onboarding persistence, and opens authenticated contact settings. It opens
the trial introduction without accepting terms or activating a trial. Authenticated
read-only queries verify the empty contact decision and selected Monday learning
day; this mode never seeds backend answers or consent through the API.

The runner generates new credentials per run and replaces the reusable smoke
credentials in every child environment. Registration screenshots, hierarchy,
process logs and detailed diagnostics remain private on the disposable worker
because images can visibly contain credentials. Only the sanitized JUnit report,
result/redaction summaries and credential-free acceptance report are uploaded.
After either success or failure, the runner attempts to sign in to its generated
identity, checks its primary email exactly, and deletes only that account through
Clerk's authenticated self-delete endpoint. Cleanup failure fails acceptance and
is recorded without credentials. If creation itself failed, an unsuccessful
cleanup attempt is reported rather than claiming that deletion was verified.

A completed registration run closes the native no-number registration evidence
gap for its tested platform and revision. Manual VoiceOver/TalkBack traversal,
product acceptance, and privacy/retention approval remain separate requirements.
