# DAY-292 onboarding review evidence

These artifacts document native rendering and interaction work on PR #458.
They are review evidence, not app assets. The canonical product decision lives
in Notion; DAY-292 remains the delivery source of truth.

## Release-contract audit — 12 August 2026

A code/spec/design-system audit found four gaps that earlier green tests did
not catch because one test had encoded the timer transition itself as expected
behavior:

1. completed account setup advanced to trial after 1.8 seconds even though the
   accepted ADR prohibits timer navigation, and its copy incorrectly promised
   an immediate first exam before trial activation;
2. failed profile or onboarding-answer persistence only logged a warning and
   left the creation loader on screen indefinitely;
3. mandatory question CTAs looked active before their local answer was valid;
4. selected weekday content borrowed `surface` as a foreground and therefore
   changed meaning by theme, while the shared design system lacked the correct
   solid-cyan foreground token.

The code contract now requires a manual “Weiter zur Testphase” handoff, exposes
post-auth failures with an “Erneut versuchen” action, derives CTA availability
from the same validation used at submission, and uses `onPrimary` for solid
cyan selections. `onPrimary` is `#1A1A1A` in both themes: measured contrast on
`#00BAFF` is 7.85:1, versus 2.22:1 for white. Auth-flow primary and back actions
now reuse the shared `Button` and `BackButton` implementations.

The audit also removed two unsupported promises. Grade and federal state are
stored profile data at launch, but no current task, language, or recommendation
consumer uses them. Their copy now says only that the answer is stored in the
school profile. Reintroducing a personalization claim requires an implemented,
tested consumer and an updated decision record.

Automated regression coverage proves the four code contracts. Fresh native
recovery recordings now cover the changed retry and completion screens in iOS
dark mode and Android light mode. They do not replace the remaining broader
profile-screen device, theme, system-text-size, and assistive-technology
matrix. The older screenshots below predate this audit and are not cited as
proof of the changed completion boundary.

## Field-local validation feedback — 12 August 2026

The wheel-style question layout previously centered the answer control in a
flexible region but rendered validation feedback after that region. The result
was an orphaned message halfway between the control and the fixed CTA. This was
not an intentional global form-error location: it weakened the relationship
between the error and the field that needs correction.

The shared question renderer now keeps a reserved validation slot directly
below the answer control. The slot exists before and after validation so the
control does not jump when the message fades in. A changed answer immediately
clears the stale field error instead of waiting for another CTA press. This
applies to grade, federal state, school type, birth-date segments, and the other
non-immersive question types; informational fact and payoff screens do not
receive an empty slot.

- `ios-dark-state-validation-error.png`: native iOS dark-mode validation state
  on the federal-state screen.
- `android-dark-state-validation-error.png`: native Android dark-mode
  validation state on the same screen. The floating gear is the development
  launcher overlay and is not production UI.

Automated regression evidence first failed while the alert remained a sibling
of the answer group, then passed after the alert moved into the reserved slot.
The test also verifies that the slot is present while empty before submission.

## Restart-safe post-auth completion — 13 August 2026

The earlier retry implementation kept onboarding answers only in React state.
It prevented an infinite loader in the current process, but a terminated app
could restore the Clerk session with no local answers and incorrectly continue
to trial before `userLearningTimes` existed.

The registration boundary now writes the exact operational persistence payload
to an encrypted, versioned, account-bound outbox before Clerk can finish account
creation. The created Clerk user is bound before session activation. On launch,
auth routing waits for the outbox and returns an affected account to the setup
surface. A failed profile or answer sync leaves the payload available for the
same targeted retry after a process restart. Confirmed Convex success removes
the answer values but keeps an answer-free completion marker until the learner
explicitly chooses “Weiter zur Testphase”.

Corrupt and expired entries discard their answer values and enter a focused
learning-time recovery step instead of silently continuing. The durable payload
never contains a password, verification code, token, name, birth date, or raw
e-mail address.

Automated evidence covers process restart, exact-payload resume, failed sync
retention, success cleanup, registration-attempt and Clerk-user binding,
cross-account rejection, expiry/corruption recovery, and routing precedence.

The following recordings add native process-lifecycle evidence. Both use a
development client and a temporary local fault gate to make the sync boundary
fail deterministically. The recordings exercise the real native lifecycle and
encrypted SecureStore adapter, but they are not Store-binary evidence. The
temporary gate and source-level test prefills were removed after capture;
Android development-app data and the host/simulator pasteboards were cleared.
None of that instrumentation is part of the committed product code.

### iOS dark-mode recovery

`ios-restart-safe-recovery-final-head.mp4` is an uncut iPhone 17 Pro / iOS 26.5
simulator recording:

> Coverage: 237.84-second video; 80 full-timeline frames sampled at 0.336368 fps
> (2.972938-second interval); 5 contact sheet(s); no audio stream.

Timestamped observations:

- `00:00–00:44`: the failed completion surface stays actionable with “Erneut
  versuchen”.
- `00:47–02:12`: the app process is terminated; the recording contains no app
  UI during the stopped interval.
- `02:21–02:29`: a fresh development-client launch is visible.
- `02:32–02:38`: account setup resumes through the creation loader.
- `02:41–03:18`: the persisted failure returns to the same retry surface; the
  app does not remain on the loader.
- `03:21–03:57`: the manual retry reaches “Dein Konto ist bereit” and remains on
  the explicit “Weiter zur Testphase” handoff.

### Android light-mode recovery

`android-restart-safe-recovery-final-head.mp4` is an uncut Pixel 9 emulator
recording. The Android application is force-stopped with `am force-stop` and
then launched again while the screen recording continues:

> Coverage: 143.62-second video; 80 full-timeline frames sampled at 0.557028 fps
> (1.795241-second interval); 5 contact sheet(s); 144 additional frames from
> 00:00:15.000 to 00:01:00.000 at 2 fps; 28 additional frames from
> 00:01:32.000 to 00:01:50.000 at 4 fps; no audio stream.

Timestamped observations:

- `00:00–00:18`: the initial failed completion surface remains actionable.
- `00:19–00:22`: the app is absent while the native process is stopped.
- `00:23–00:47`: the development client follows a fresh launch path.
- `00:48–00:53`: account setup resumes through the creation loader.
- `00:55–01:42`: the persisted failure returns to the retry surface rather than
  an endless loader.
- `01:44–02:23`: the manual retry reaches and retains the explicit success
  handoff.

Together these recordings close the platform recovery-lifecycle gate and add
fresh light/dark rendering evidence for the changed retry and completion
surfaces. They do not prove trial activation or the first empty-home action.

### Explicit completion handoff to trial terms

`ios-completion-to-trial-terms-final-head.mp4` is an uncut iPhone 17 Pro /
iOS 26.5 simulator recording. It retains the explicit completion screen through
`00:08.5`; the learner-triggered “Weiter zur Testphase” action then reaches the
trial-terms screen at `00:09`. The trial CTA is not invoked because it explicitly
accepts the trial conditions, so this clip is evidence for the handoff boundary
only, not trial activation or app-home entry.

> Coverage: 9.33-second video; 19 full-timeline frames sampled at 2 fps
> (0.5-second interval); 2 contact sheet(s); no audio stream.

## Live duration preview worklet crash — 13 August 2026

The first live-preview implementation called the ordinary JavaScript helper
`getSnapCarouselPreviewIndex` synchronously from Reanimated's UI-runtime scroll
handler. Native dragging therefore raised `Tried to synchronously call a Remote
Function`, although the Jest mock passed because it executed that handler on the
JavaScript thread.

The preview-index arithmetic now stays entirely inside the UI worklet; only the
result crosses back through `scheduleOnRN`. The UI regression test asserts that
the registered scroll callback no longer references the remote helper. The iOS
bundle was exercised on iPhone 17 Pro / iOS 26.5 in dark mode: the preview
number and ring advanced from 10 to 45 during native UI-runtime scroll, repeated
three times without an error overlay.

`android-live-duration-preview-final-head.mp4` covers the corresponding Pixel 9
native UI-runtime drag. The value, ring, and centered selector move together
from 10 through 20 to 30 minutes without a Worklets error overlay:

> Coverage: 6.42-second video; 13 full-timeline frames sampled at 2 fps
> (0.5-second interval); 1 contact sheet(s); no audio stream.

This closes the Android live-preview crash/interaction gate; it is not a claim
about every Android device size.

## Native back contract — 13 August 2026

The launch architecture keeps the native iOS route gesture enabled on the first
intro page, but the full-screen intro pager can win that gesture before the
router receives it. The production-safe launch behavior therefore also installs
the same guarded interactive edge handler on the entry page. Its commit action
calls the normal route back/replace logic. This is a documented hybrid fallback,
not a claim that the captured entry transition is a native route-pop animation.
A true per-step native stack remains the long-term solution in DAY-349.

- `ios-entry-edge-back-final-head.mp4`: starts on the auth choice, opens the
  first intro, shows the committed edge translation at `00:18–00:20`, and
  returns to the auth choice at `00:20.5`.

  > Coverage: 23.29-second video; 47 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 3 contact sheet(s); no audio stream.

- `ios-internal-edge-back-final-head.mp4`: starts on the conflict-free
  explanation step, shows the committed interactive translation at
  `00:18–00:20`, and returns exactly one step to duration at `00:20.5`.

  > Coverage: 21.87-second video; 44 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 3 contact sheet(s); no audio stream.

- `android-predictive-back-internal-step-final-head.mp4`: the Android predictive
  back preview becomes visible while dragging and a committed invocation returns
  from duration to the immediately preceding name step at `00:04.5`.

  > Coverage: 5.08-second video; 10 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 1 contact sheet(s); no audio stream.

- `android-picker-sheet-first-back-final-head.mp4`: Android native back closes
  the open time picker by `00:04` and leaves the confirmed `16:00` answer and
  underlying onboarding step unchanged for the remainder of the clip.

  > Coverage: 15.88-second video; 32 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 2 contact sheet(s); no audio stream.

- `android-select-sheet-first-back-final-head.mp4`: starts on the empty grade
  step, opens the shared bounded `SelectSheet` at `00:11`, keeps it fully open
  through `00:16.5`, and shows native Android back dismissing it at `00:17`.
  The remaining five seconds retain the same `7 von 14` step, empty grade
  value, disabled CTA, and progress value.

  > Coverage: 22.26-second video; 45 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 3 contact sheet(s); no audio stream.

The time-picker and bounded-select recordings are separate on purpose. Together
they close both sheet-first dismissal branches without treating one surface as
evidence for the other.

## Accepted operational learning-time flow — 12 August 2026

The accepted release behavior asks for an intended duration, one or more
weekdays, and a start time. The confirmation shows the exact recurring windows
that registration persists as `userLearningTimes` and the planner consumes.
The former blocker/goal survey is superseded because its answers changed only
local copy.

### iOS dark mode

- `ios-dark-learning-duration.png`: centered, readable duration selector.
- `ios-dark-learning-days.png`: weekday multi-select with stable chip geometry.
- `ios-dark-learning-time-picker.png`: native iOS spinner inside the shared
  sheet.
- `ios-dark-learning-time-selected.png`: confirmed `16:00 Uhr` answer.
- `ios-dark-learning-times-payoff.png`: exact `30 Minuten`, `Montag, Mittwoch
  und Samstag`, and `16:00–16:30 Uhr` confirmation.

`ios-learning-times-e2e.mp4` covers the interactive journey from duration
through the confirmed start-time answer. Complete-timeline inspection:

> Coverage: 79.19-second video; 79 full-timeline frames sampled at 1 fps
> (1-second interval); 5 contact sheet(s); no audio stream.

Timestamped observations:

- `00:00–00:08`: duration input.
- `00:09–00:17`: manual explanation of operational time windows.
- `00:18–00:42`: weekday input; Monday, Wednesday, and Saturday are selected
  without chip reflow.
- `00:43–00:51`: start-time prompt.
- `00:52–00:59`: native iOS time picker.
- `01:00–01:18`: confirmed `16:00 Uhr` answer.

The recording ends before the confirmation page because simulator video output
lagged behind the interaction. `ios-learning-times-payoff.mp4` separately
records the rendered confirmation state. Complete-timeline inspection:

> Coverage: 1.34-second video; 3 full-timeline frames sampled at 2 fps
> (0.5-second interval); 1 contact sheet(s); no audio stream.

The split is explicit: neither clip alone is evidence of the entire flow.

### Android dark mode

- `android-dark-learning-duration.png`: centered, readable duration selector.
- `android-dark-learning-days.png`: stable weekday multi-select with Monday,
  Wednesday, and Saturday selected.
- `android-dark-learning-time-picker.png`: native Android 24-hour dialog with
  separate cancel and confirm actions.
- `android-dark-learning-time-selected.png`: confirmed `16:00 Uhr` answer.
- `android-dark-learning-times-payoff.png`: exact `30 Minuten`, `Montag,
  Mittwoch und Samstag`, and `16:00–16:30 Uhr` confirmation.

The Android screenshots were captured in a development client. Its floating
gear in the upper-right is a development-launcher overlay and is not rendered
in a production build.

### Weekday pill motion contract

Selecting or unselecting a weekday uses a 180 ms ease-out transition. The
background, border, label, and fixed-slot checkmark interpolate together;
press-in and press-out add 80 ms and 120 ms scale feedback. The icon slot stays
mounted in both states and a matching trailing slot keeps the label visually
centered, so neither the pill, its label, nor the surrounding layout moves.
Unselected pills use the semantic `systemSubtle` fill and `path1` border rather
than a white surface. This makes the all-unselected state read as one calm,
interactive choice group in light mode without borrowing the cyan selected
state; the same tokens preserve clear separation in dark mode. When the
operating system requests reduced motion, the semantic selected state still
changes but the decorative transition is skipped.

- `ios-light-weekday-pills-empty.png`: all-unselected light-mode state with
  centered labels and a visible grouped surface.
- `ios-dark-weekday-pills-empty.png`: all-unselected dark-mode state.
- `android-light-weekday-pills-empty.png`: matching Android light-mode state;
  the floating gear is the development-launcher overlay described above.

The same implementation was verified on both native platforms:

- `ios-weekday-pill-animation.mp4`: Monday and Wednesday are selected and
  unselected. Complete-timeline and 20 fps focused inspection show intermediate
  fill/checkmark states at `00:10.05–00:10.20`, `00:11.85–00:12.00`,
  `00:13.55–00:13.70`, and `00:15.25–00:15.35`. No pill geometry or neighboring
  position changes.

  > Coverage: 16.61-second video; 33 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 3 contact sheet(s); 107 additional frames from
  > 00:00:10.000 to 00:00:16.500 at 20 fps; no audio stream.

- `android-weekday-pill-animation.mp4`: Monday and Wednesday are selected and
  unselected. Complete-timeline and 20 fps focused inspection show intermediate
  fill/checkmark states at `00:01.40–00:01.50`, `00:02.50–00:02.65`,
  `00:03.85–00:04.00`, and `00:05.10–00:05.15`. The fixed layout is preserved.
  The floating gear is the development-launcher overlay described above.

  > Coverage: 6.04-second video; 12 full-timeline frames sampled at 2 fps
  > (0.5-second interval); 1 contact sheet(s); 94 additional frames from
  > 00:00:00.500 to 00:00:05.200 at 20 fps; no audio stream.

### Supporting automated evidence

- UI tests require explicit weekday input, hold picker changes as draft state,
  and persist the start time only after confirmation.
- Flow tests require duration, weekdays, and start time and map only those
  operational answers plus state, school type, and grade into the persistence
  payload. The separate registration payload contains account and profile fields.
- Backend tests assert that the release payload creates one concrete recurring
  window per selected weekday.
- Planner tests assert that those persisted windows are visible to learning-plan
  scheduling.

## Content-size and compact-phone audit — 14 August 2026

The first iPhone 13 mini / maximum Dynamic Type pass exposed a real release
defect: the fixed intro composition kept its artwork, title, description, dots,
and CTA in one viewport while every text descendant scaled. The result clipped
the meaningful heading and button and also enlarged microtype inside the
decorative artwork until it escaped its cards.

The intro now keeps the approved fixed pager at the default content size but
switches to a vertically scrollable composition when system text is enlarged.
The actual title, description, CTA, and duration note continue to use native
system scaling and reflow; only the decorative fixed-artboard microtype opts out
of scaling. The decorative section badge is omitted in that accessibility
layout so the learner reaches the useful explanation and action sooner.

- `ios-small-light-intro-final-head.png`: iPhone 13 mini, standard content
  size, light appearance.
- `ios-small-dark-intro-final-head.png`: the same compact phone and content
  size in dark appearance.
- `ios-large-light-intro-final-head.png`: iPhone 17 Pro Max, standard content
  size, light appearance.
- `ios-large-dark-intro-final-head.png`: the same large phone and content size
  in dark appearance.
- `android-small-light-intro-final-head.png`: Pixel 9 emulator with a temporary
  720 × 1600 / 320 dpi logical-display override, standard font scale, light
  appearance.
- `android-small-dark-intro-final-head.png`: the same compact logical display
  and font scale in dark appearance.
- `android-large-light-intro-final-head.png`: Pixel 9 emulator at its physical
  1080 × 2424 / 420 dpi display, standard font scale, light appearance.
- `android-large-dark-intro-final-head.png`: the same large display and font
  scale in dark appearance.

The iPhone 13 mini pair was captured after the responsive implementation was
loaded in the development client. The four Android captures and the two large
iOS captures extend that check across the compact/large and light/dark intro
matrix.
Android's compact size is an explicit logical-display override on the same
Pixel 9 AVD, not a claim of separate small-phone hardware. Every override was
reset to the physical display after capture. The floating gear is the
development-launcher overlay and is not production UI.

## Final code-review closure — 14 August 2026

The final Standards and Spec review found two product-contract gaps and five
concrete implementation/documentation gaps that the earlier focused review had
not covered. They are closed in the final code candidate:

- the centered 30-minute duration is now an uncommitted preview until the
  learner explicitly selects it or another value;
- the large-text auth-choice entrance respects Reduced Motion;
- incomplete recovery answers cannot submit;
- post-auth persistence failures use the shared polite, selectable error
  contract;
- the three-page introduction exposes numeric accessibility progress;
- a cancelled iOS edge gesture cannot commit back navigation;
- the editable upload artwork and its theme/content-size behavior are now
  covered by the artwork rendering ADR.

The same closure also tightens integration boundaries found by the full-diff
review: legacy decorative answers are accepted only for installed-client
compatibility and are excluded by an explicit persistence allowlist; account-
bound outbox records cannot be replaced by another registration or Clerk user;
owned sync success cannot clear an unrelated failure; and dashboard
announcements omit unavailable date/time values instead of speaking “null”.

The final lifecycle pass then closed two additional race windows. Android back
is captured from a sheet's requested opening through its native dismissal, so
back cannot leak to the underlying route before presentation or while the sheet
is still closing. Trial-reminder cleanup now waits until both access loading and
onboarding completion are settled; logout still removes the reminder
immediately, while transient unresolved state preserves it. Focused native-UI
tests cover deferred opening, in-flight dismissal, access loading, and pending
onboarding before the complete repository suite is run on the final commit.

These are code and automated-test conclusions. They do not replace the
remaining owner, physical-assistive-technology, or legal trial-activation gates
listed in the PR checklist.

`ios-small-axxxl-intro-scroll-final-head.mp4` is an uncut iPhone 13 mini /
iOS 26.5 recording at the maximum accessibility content size. Five native
vertical swipes are sent on each page. The first and second CTA transitions
reset the following page to its top before that page is scrolled. The title,
description, dots, CTA, and footer remain readable and reachable on all three
pages; the final CTA wraps but remains fully visible and operable.

> Coverage: 64.47-second video; 64 full-timeline frames sampled at 1 fps
> (1-second interval); 4 contact sheet(s); 25 additional frames from
> 00:00:32.000 to 00:00:37.000 at 5 fps; 25 additional frames from
> 00:00:45.000 to 00:00:50.000 at 5 fps; no audio stream.

Timestamped observations:

- `00:00–00:25`: page one is scrolled until “Weiter” and the duration note are
  reachable.
- `00:34.6`: page two opens at its top; its CTA is reached by approximately
  `00:39`.
- `00:47.6`: page three opens at its top; the wrapped final CTA is reached by
  approximately `00:52` and retained through the end.

`android-large-font2-intro-final-head.mp4` is an uncut Pixel 9 emulator
recording at Android `font_scale=2.0`. The large display can show each complete
responsive page without vertical displacement, so the recorded native swipes
reach the scroll boundary immediately. Both CTA transitions complete and the
final CTA remains readable and reachable. The final two seconds show the
development activity clearing while the temporary system settings are reset;
the verified intro journey has already completed and page three is retained
before that teardown.

> Coverage: 62.50-second video; 63 full-timeline frames sampled at 1 fps
> (1-second interval); 4 contact sheet(s); 67 additional frames from
> 00:00:22.000 to 00:00:38.000 at 4 fps; no audio stream.

Timestamped observations:

- `00:00–00:22`: page one remains complete and actionable at font scale 2.0.
- `00:22.00–00:22.25`: the first CTA advances cleanly to page two.
- `00:22.25–00:31.00`: page two remains complete and actionable.
- `00:31.00–00:31.25`: the second CTA advances cleanly to page three.
- `00:31.25–01:00`: page three and “Meinen Start personalisieren” remain
  visible without an error overlay.

`ios-small-reduced-motion-intro-final-head.mp4` is an uncut iPhone 13 mini /
iOS 26.5 recording with the system `ReduceMotionEnabled` preference set before
the React Native tree mounted. The development runtime independently reported
that reduced motion was enabled. Both CTA advances replace the current page
directly with the fully composed destination page; the encoded frames contain
no horizontal pager position or partially composed intermediate state. The
preference was reset to its original disabled value after capture.

> Coverage: 14.02-second video; 42 full-timeline frames sampled at 2 fps
> (0.5-second interval); 3 contact sheet(s); 143 additional frames from
> 00:00:06.000 to 00:00:07.500 at 20 fps; 143 additional frames from
> 00:00:13.000 to 00:00:14.023 at 20 fps; no audio stream.

Timestamped observations:

- `00:06.758`: page two is first encoded as a complete destination after the
  page-one CTA; there is no encoded horizontal or partial pager state.
- `00:13.920`: page three is first encoded as a complete destination after the
  page-two CTA; there is no encoded horizontal or partial pager state.

`android-reduced-motion-intro-final-head.mp4` is an uncut Pixel 9 emulator /
Android recording with all three system animation scales set to zero before
the React Native tree reloaded. The development runtime independently logged
that Reanimated detected Reduced Motion. An initial candidate recording was
rejected because the non-animated `FlatList` jump exposed one blank virtualized
page frame. The accepted implementation keeps all three fixed intro pages
mounted and disables clipped-subview removal; the focused final-head recording
contains no blank, horizontally displaced, or partially mounted pager content.
The three temporary system animation settings were restored to `1 / 1 / 1`
and verified immediately after capture.

> Coverage: 13.47-second video; 27 full-timeline frames sampled at 2 fps
> (0.5-second interval); 2 contact sheet(s); 154 additional frames from
> 00:00:08.000 to 00:00:08.500 at 30 fps; 5 additional frames from
> 00:00:13.000 to 00:00:13.460 at 30 fps; no audio stream.

Timestamped observations from the source encoder frames:

- `00:00.000–00:08.262`: page one remains complete, including the pressed CTA
  state.
- `00:08.293`: page two is first encoded as a complete destination; there is
  no encoded horizontal, blank, or partial pager state.
- `00:08.307–00:13.314`: page two remains complete and actionable.
- `00:13.433`: the fixed CTA has its destination label while the complete page
  two pager content remains mounted; this compositor step lasts until the next
  encoded frame and does not expose an empty or partial page.
- `00:13.446`: page three is encoded completely, including artwork, copy,
  indicator, and CTA.

The initial clipped maximum-size screenshot and theme-transition frames that
were captured before all text had rendered are deliberately not retained as
release evidence.

## Full profile/account matrix — 14 August 2026

Three accepted native runs now cover the complete intro plus all 14 profile and
account questions through the empty password screen. Each profile directory
contains the uncut recording and one screenshot for every captured state. The
shared reproducible Android flow is
`maestro/android-profile-account.yaml`. It deliberately stops before entering a
password: no account is created, no trial terms are accepted, and none of these
runs is evidence for trial activation or app-home entry.

### Android Pixel 9, dark, standard system text

`profile-matrix/android-pixel9-dark/android-pixel9-dark-profile-account.mp4`
starts on the auth choice, traverses all three intro pages and all 14 profile
and account steps, and retains the empty password screen at the end. The 15
adjacent screenshots cover the empty and selected duration states plus every
subsequent step. The floating gear is the development-launcher overlay, not
production UI.

> Coverage: 126.04-second video; 80 full-timeline frames sampled at 0.634697 fps
> (1.575554-second interval); 5 contact sheet(s); 17 additional frames from
> 00:02:02.500 to 00:02:06.040 at 5 fps; no audio stream.

### Android Pixel 9, light, `font_scale=2.0`

`profile-matrix/android-pixel9-light-font2/android-pixel9-light-font2-profile-account.mp4`
repeats the same complete path with Android system text enlarged to 2.0. An
earlier candidate exposed a real collision between the duration number and
unit at large content sizes. The accepted run uses the corrected optical
spacing: number and unit remain distinct without disabling system text scaling.
Focused inspection shows the live duration preview moving through 30, 45, 60,
and 90 minutes while the native selector is in motion, with no Worklets error
overlay. Android display, theme, font scale, and animation-scale overrides were
restored after capture.

> Coverage: 237.17-second video; 80 full-timeline frames sampled at 0.337317 fps
> (2.964573-second interval); 5 contact sheet(s); 93 additional frames from
> 00:00:44.000 to 00:01:00.000 at 5 fps; 36 additional frames from
> 00:03:50.000 to 00:03:57.166 at 5 fps; no audio stream.

Seven earlier automation candidates are intentionally not cited as release
proof: they contained the pre-fix collision, a blank development-client/auth
surface, or selector timing/coordinate failures. The eighth run above is the
first accepted complete candidate.

### iPhone 17 Pro Max, dark, standard system text

`profile-matrix/ios-iphone17promax-dark/ios-iphone17promax-dark-profile-account.mp4`
is an uncut simulator recording of the auth choice, all intro pages, all 14
profile/account steps, and the final empty password screen. Simulator
accessibility-driver stalls made this an automation-assisted manual run; the
long stationary intervals reflect external control retries and must not be
used as performance evidence. All user-visible states remain in the source
timeline.

> Coverage: 1224.50-second video; 80 full-timeline frames sampled at 0.065333
> fps (15.306229-second interval); 5 contact sheet(s); 300 additional frames
> from 00:04:00.000 to 00:04:45.000 at 5 fps; 172 additional frames from
> 00:19:50.000 to 00:20:24.498 at 5 fps; no audio stream.

Timestamped observations:

- `00:00–00:46`: auth choice and all three intro pages.
- `01:01–08:40`: name, operational duration, weekday/time input, and exact
  learning-time payoff. Focused frames show the live duration value changing
  from 30 to 45, 60, and 90 at `04:25.2–04:25.8`, before release.
- `08:55–18:06`: grade, federal state, school type, and the three birth-date
  segments.
- `18:22–20:18`: e-mail input. An invalid intermediate value produces the
  field-local error and is corrected on the same screen; the valid value clears
  the error and enables “Weiter”.
- `20:22.0–20:22.8`: the e-mail is processed and the empty password screen
  replaces it. The recording stops there.

This closes a representative complete-profile rendering and interaction pass
for Android dark, Android light with enlarged text, and iOS dark. It does not
turn those three profiles into proof for every platform/device/theme/text-size
permutation or for physical assistive-technology behavior.

## Historical evidence — superseded 11 August state

`ios-onboarding-e2e-2x.mp4` predates the accepted operational learning-time
decision. It documents the former blocker/goal implementation and therefore
does **not** verify the current weekday, time-picker, confirmation, or
persistence behavior.

- Runtime: 02:28 at 2x playback; H.264, 720 x 1566, no audio.
- Full-timeline sampling coverage: **Coverage: 148.30-second video; 80
  full-timeline frames sampled at 0.539447 fps (1.85375-second interval); 5
  contact sheet(s); no audio stream.**
- Timestamped observations:
  - `00:00–00:14`: all three educational intro pages.
  - `00:14–00:22`: name and the former daily study-time input.
  - `00:22–00:37`: the now-superseded fact, blocker, and goal.
  - `00:37–00:42`: the now-superseded local-copy payoff.
  - `00:42–01:23`: grade, federal state, and bounded school type.
  - `01:23–02:11`: birth year, month, and day as separate selections.
  - `02:11–02:17`: email input.
  - `02:17–02:28`: empty password screen; account creation is not submitted.

The older light/dark intro screenshots and linked Linear attachments remain
historical rendering evidence. They must not be cited as proof of the accepted
learning-time contract.

## Remaining release evidence

This evidence set now proves the operational learning-time segment, native
iOS/Android restart recovery, Android live duration preview, committed iOS entry
and internal edge behavior, Android predictive back, native time-picker-first
dismissal, shared bounded-select-first dismissal, the intro's small/large
light/dark matrix, and the responsive intro at maximum iOS and enlarged Android
system text. It also proves the intro's iOS and Android reduced-motion CTA
behavior and three complete 14-step native profile/account runs: Android dark,
Android light at `font_scale=2.0`, and iOS dark. It does not by itself prove
every profile screen in every device/theme/text-size combination, physical
VoiceOver/TalkBack behavior, trial activation, or the first empty-home action.
PR #458 stays Draft until the remaining canonical acceptance gates are closed
by the decision owner.
