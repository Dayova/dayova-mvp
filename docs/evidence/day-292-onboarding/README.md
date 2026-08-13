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

Automated regression coverage proves the four code contracts, but the changed
completion and retry screens still need fresh native light/dark evidence before
this PR can leave Draft. The existing screenshots below predate this audit and
must not be cited as proof of those changed screens.

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
Fresh native iOS and Android recordings of failure → force-close → resume →
success remain required before this PR leaves Draft; automated tests are not
cited as native process-lifecycle proof.

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
  operational answers into the registration payload.
- Backend tests assert that the release payload creates one concrete recurring
  window per selected weekday.
- Planner tests assert that those persisted windows are visible to learning-plan
  scheduling.

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

This evidence set proves the operational learning-time segment on native iOS
and Android. It does not by itself prove account creation, email verification,
trial activation, first empty-home action, reduced motion, the complete back
contract, or a second device size. The 2026-08-12 implementation pass confirmed
Android system back from an internal profile step returns exactly one step, and
confirmed Android native time-picker back closes the picker without changing
the underlying onboarding step. The iOS simulator also confirmed an incomplete
edge drag leaves the internal step unchanged. Remaining back-navigation
evidence must still cover iOS entry-route pop, iOS committed internal edge
swipe, Android predictive-back invocation, and shared select-sheet-first
dismissal before an underlying onboarding step changes. PR #458 stays Draft
until the canonical acceptance gates are closed.
