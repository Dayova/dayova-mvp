# DAY-292 onboarding review evidence

These artifacts document native rendering and interaction work on PR #458.
They are review evidence, not app assets. The canonical product decision lives
in Notion; DAY-292 remains the delivery source of truth.

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
mounted in both states, so neither the pill nor the surrounding layout moves.
When the operating system requests reduced motion, the semantic selected state
still changes but the decorative transition is skipped.

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
trial activation, first empty-home action, reduced motion, or a second device
size. PR #458 stays Draft until the canonical acceptance gates are closed.
