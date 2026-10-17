## Topic layout and inline hint search — 18 October 2026

[Latest incremental screenshots, recordings, revisions and limitations](topic-hint-layout-2026-10-18.md). Product 30c80460; iOS component fixture with controlled results. Uploaded through GitHub CLI to a separate evidence archive; no product media binaries. Earlier evidence below retains its original scope.

## Current selection-and-notes correction — 17 October 2026

[Latest regular-app native acceptance, persistence checks and pause fix](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6235441405). This report tracks the later Android run and its own platform limits. Earlier galleries below retain their original revision and scope.

[Real Pixel 9 before/after and chip-removal gallery](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6226000485). Product a844f7a1, preview 7b7d615d with startup fix #891. The selected topic stays visible after clearing search; the separate “Test ist ohne Hilfsmittel” text survives removal unchanged. No fixture. [Uploaded asset URLs and SHA-256](selection-attachments.json). That Pixel gallery itself does not establish native save/reopen, large-text or screen-reader acceptance.

> **17 October 2026:** The galleries below show earlier revisions that appended selected titles to the editor. They are historical evidence. PR #884 now separates visible topic selections from additional information; see the [updated contract](../../contexts/product/adr/inline-topic-search-with-free-scope.md) and [latest QA section](../../qa/inline-topic-search-2026-10-16.md). Do not use earlier screenshots as acceptance of the new interaction.

# PR #884: native review evidence

## Latest native-build and acceptance follow-up

The [QA acceptance matrix](../../qa/inline-topic-search-2026-10-16.md#native-acceptance-disposition)
records the fresh Pixel/Android builds, successful current-source iOS build,
all-green 1,099-test run and current-head CI. Pixel installation and regular
registration/login startup are confirmed. The signed-in Android journey remains
blocked at development-client loading; EAS Simulator is not enabled for Dayova.
VoiceOver on a physical iPhone was explicitly deferred by Jakob. No new
full-route screenshots or recordings are presented as passed evidence.

## Current follow-up: derived subject context

Product source: `bf90d6390da34659ba61b6057d1319d7f93a0310`.
[Current gallery: eight screenshots and one recording](https://github.com/Dayova/dayova-mvp/pull/884#issuecomment-6222821260).
Files, stable GitHub asset URLs, timestamps and hashes are in
[`context-attachments.json`](context-attachments.json). No media binaries are committed.

Personal subjects keep their existing identity, ownership and persistence.
The selected name supplies internal ranking hints; exact title matches remain
available across subjects and unknown names do not create an invented category.
There is no additional subject picker or mandatory mapping step. Only the chosen
title is appended to the authoritative scope. Provider subject labels are display
context, not part of the learner's saved scope.

| Capture | Current case |
| --- | --- |
| 41 | Live Bilanz/Rechnungswesen now returns Bilanz and Handelsbilanz labelled Wirtschaftskunde. |
| 42 | Explicit selection preserves Inventur and appends only Bilanz. |
| 43 | Historical Mathematik/Bilanz retains the exact match and marks Handelsbilanz as an additional suggestion. |
| 44 | Unknown personal name Mein Spezialfach still returns title matches. |
| 45 | Mathe LK uses the internal mathematics context. |
| 46 | Combined Wirtschaft und Recht supports the accounting search. |
| 47 | Controlled ambiguous Zelle response demonstrates Biologie/Informatik labels and additional suggestions; not evidence that WLO currently supplies both titles. |
| 48 | Live accounting results in dark appearance. |

`context-accounting.mp4` covers accounting, explicit append, the historical
mathematics selection and an unknown name. Its complete-timeline inspection is
in [`video-observations.md`](video-observations.md#context-accountingmp4).
The subject in the tiny footer and floating Tools control belong to the fixture
and development client, not to the product flow.

The captures use the same dedicated read-only Android emulator and reused APK
described below. Its initially installed older client crashed in native worklets
before capture; reinstalling the already verified APK allowed the new captures.
This is not a new native build. The larger-font attempt restarted the fixture
into its default state and later hung in device control; those attempted images
are excluded and do not establish current large-font acceptance. Earlier static
text rendering findings remain open; this recording does not prove a fix.
iOS, screen readers, actual personal-subject creation and persisted save/reopen
remain outside this isolated evidence.

After preparing the isolated entry and starting the same local adapter/Metro
below, reproduce with `node scripts/evidence/pr884/context-run.cjs`.
For six read-only development-action checks with synthetic CLI identity, run
`node scripts/evidence/pr884/live-context.mjs <output.json>`.
The checked report is [`live-context.json`](live-context.json); it establishes
provider behavior through the authenticated action, not Clerk sign-in or student
validation. The script pins the development deployment explicitly.

## Initial gallery: historical source and coverage

Product source: `d126c3d4d84427aa8dea2769b54c443e5fc45f62`.
Before source: `3eb4e5d29f8cb2771fb79825c3b447587c514740`.
That first evidence follow-up changed tooling and documentation only. Its media
predates the subject-context change above; its empty Rechnungswesen search is
historical, not the current result.

Screenshots and recordings are uploaded as GitHub attachments on
[PR #884](https://github.com/Dayova/dayova-mvp/pull/884), rather than tracked as
repository binaries. `attachments.json` records the full-size URLs, hashes and
capture times. The PR description contains the before/after comparison and a
linked gallery organized by scenario.

## What the captures establish

These are native Android captures of the actual `RequiredTopicsStep`,
`TopicSearch`, shared controls, keyboard-aware scroll host and creation progress
header. The before component is generated verbatim from the integration base
inside `src/` so NativeWind compiles its original classes, including `h-48`.
Both versions use the same device, fonts, outer layout and data for comparisons.

The isolated entry does not load Clerk, analytics, user accounts or production
data. It supplies controlled props and provider failures to exercise the entire
visible state space. Independent fixture scenes remount the native container;
this is a test-harness choice, not production navigation. The small
footer identifies this isolation and the current scenario in every capture.

**Open native rendering finding:** some static text disappears visually during
scenario switches/development refreshes while remaining in the native
accessibility hierarchy. This is retained in the raw captures, not retouched.
See the video observations. The fixture remount does not establish a fix. Its
presence in the full signed-in route and a matching native/release build has
not been determined; native acceptance remains open.

Live-provider scenes call the **unchanged `searchWloTopics` implementation**
through a loopback-only local Node adapter. They demonstrate real WLO responses,
not a Clerk-authenticated Convex action or a complete signed-in app journey.
Other scenes inject explicitly deterministic responses and delays. No endpoint,
provider mock, deep-link evidence handler or synthetic state is added to the
production entry.

The material-step transition is local fixture state. It demonstrates preservation
of the editor value through unmount/back; it does **not** prove a database write,
app-restart recovery or personal-subject creation. Route save/back and subject
ownership/persistence have separate automated coverage. Creating a personal
subject end to end, iOS, TalkBack and VoiceOver remain unverified here.

## Visible state matrix

| Capture IDs | Scenario and interpretation |
| --- | --- |
| 01 / 02 | Before/after empty state on the same device; Continue disabled. |
| 09 / 10 | Before/after the identical multiline scope with `ohne Hilfsmittel`. |
| 15 / 13 / 14 | Before/after the same 455-character, 16-item tax scope; bottom and Continue reachable by scrolling. |
| 03–06 | Controlled suggestion result, append to existing detail, edit/remove, then re-add without replacing the edit. |
| 07 / 08 | Material component and return with the complete edited scope; local state only. |
| 11 / 12 | Accounting list under personal subject `Rechnungswesen` and historical `Mathematik`, respectively. No automatic reclassification. |
| 16 | A single meaningful topic, `Evolution`, can continue. |
| 17 / 18 | Vague repetition and a page/task reference remain intact and are accepted. The UI does not yet ask for clarification or interpret the referenced page. |
| 19 / 21 | Known placeholder `asdf` blocked and visible validation error. |
| 20 | Saving disables search, editor and Continue; actual route busy gating is reflected in fixture props. |
| 22 / 23 | Two-character hint, loading and Android keyboard. |
| 24 / 25 | Controlled provider error leaves free entry available; explicit retry recovers. |
| 26 | Live `Gedichtsanalyse` / Deutsch returns `Gedichtanalyse`. This establishes only this spelling normalization. |
| 27 | Live `Bilanz` / Rechnungswesen returns no suggestions; the full free scope and Continue remain available. Custom-subject taxonomy coverage is still limited. |
| 28 | Complete tax list after material/back, including the final Rohgewinn line. |
| 29 | Controlled no-results state with free entry and enabled Continue. |
| 30 | Search exceeding 100 characters remains visible with guidance; no provider request. |
| 31 / 32 | Seven controlled suggestions yield five rows plus refinement guidance; editor and Continue remain reachable. |
| 33 | Delayed previous response cannot replace the current result. |
| 34 / 35 | Subject changes with the same query and return to the earlier subject. Automated tests additionally assert request/cache counts. |
| 36 | Dark appearance with a realistic scope. |
| 37 / 38 | System font scale 2.0: top and scroll to the complete scope/Continue. |
| 39 / 40 | Smaller 320-dp-wide viewport: search with keyboard and scroll to the scope/Continue. |

Historical examples are anonymous topic text without account identifiers. The
accounting example omits its trailing object-replacement character. They are
representative cases from the analysis, not a replay of every historical record
against the live provider.

## Runtime and reproduction

- Dedicated read-only Android 16 / API 36 emulator, x86_64.
- Normal viewport: 720×1600 pixels, density 270 (approximately 427 dp wide).
- Smaller viewport: 540×1200 pixels, same density (320 dp wide).
- Installed development client: Dayova 1.0.5, versionCode 1.
- APK SHA-256: `BF286F35576B7CAED1BFABB10AFEA40D4FD7F355BD83BD5A3E4CD4D6F7C2423A`.
- JavaScript: repository lockfile, React Native 0.86.3, Expo 57.0.20.
- Existing development binary reused; this is not a fresh native build from the
  PR lockfile. No release-binary compatibility or production deployment claimed.

Use a dedicated installed Android development client. From the repository root,
prepare the isolated entry **before starting Metro**, then run the local adapter
and Metro in separate terminals:

```powershell
node scripts/evidence/pr884/prepare.cjs
node scripts/evidence/pr884/server.mjs
# In another terminal:
$env:APP_VARIANT = 'development'
pnpm exec expo start --dev-client --port 8086 --lan
```

Set `EVIDENCE_DEVICE` to the dedicated device serial (default `emulator-5574`),
and optionally `EVIDENCE_OUTPUT` to an absolute temporary directory. Reverse
ports 8086 and 8764 with adb and connect the client to `http://127.0.0.1:8086`.
Wait until the isolated-component footer is visible before selecting a scenario.

```powershell
node scripts/evidence/pr884/capture.cjs open before
node scripts/evidence/pr884/capture.cjs shot 01-before-empty
node scripts/evidence/pr884/capture.cjs open after
node scripts/evidence/pr884/run.cjs recovery
node scripts/evidence/pr884/run.cjs provider
node scripts/evidence/pr884/run.cjs limits
```

`open` accepts `topics=…`, `subject=…`, and `theme=dark` arguments. `tap` resolves
the visible native accessibility label from a fresh hierarchy. `shot` refuses
captures when the evidence component is not ready. `capture.cjs` also offers
`type`, `replace`, `hide-keyboard`, `scroll`, `record`, and `stop-record`.
Recordings contain the real device frames; no synthetic transitions or audio.

Stop Metro and the local adapter before restoring the entry, to avoid a live
entry-point swap. Restore any device font/viewport overrides and stop the
dedicated emulator. Then run:

```powershell
node scripts/evidence/pr884/prepare.cjs --restore
git diff -- index.ts
```

The generated baseline and entry change must never be staged or published.
Media belongs in temporary storage and GitHub attachments. See
`video-observations.md` for full-timeline coverage and timestamped observations.
