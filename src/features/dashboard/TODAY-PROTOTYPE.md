# Today decision demo — throwaway, not a production change

Question: does one stable next-action card, a compact week selector and a quiet
create-plan action make Today understandable while Plans stays a separate overview?

Context: [DAY-483](https://linear.app/dayova/issue/DAY-483/align-on-removing-the-dashboard-for-the-mvp).
This demo does not decide that issue or remove existing production screens.

## Run

With the project's dependencies installed and a matching Dayova development client:

```sh
npm run demo:today
```

Open `http://localhost:8093` in the development client. The opt-in
`EXPO_PUBLIC_TODAY_DEMO=1` entry bypasses authentication and backend providers.
Without the flag, the normal Expo Router entry runs unchanged. Never deploy this
throwaway branch as a production feature.

Local review checkout: `/private/tmp/dayova-today-demo`.
Dedicated simulator: **Dayova Heute Demo**, iPhone 17 / iOS 26.4.
The existing shared QA simulator and its app data are not replaced.

## Decision brief

Job: immediately find the next useful learning action.
Hierarchy: next action, week/day choice, remaining blocks.
Primary action: create/finish a first plan, otherwise start/resume learning.
Friction removed: large greeting/calendar, carousel and duplicate next-step row.
Choice: retain Today and Plans as distinct jobs; keep secondary creation compact.

## Try

The bottom **Demo · … · Zustand wechseln** control selects ready, new, unfinished
plan, resume, completed, unscheduled and error states. Creation and learning sheets
only simulate transitions. Completing a block advances the next action; pausing
returns to the same block. All state is in memory and resets on reload.

The week selector changes only the list below it, not the next-action card.
Plans is a placeholder overview, not a redesign of the real plan detail flow.
Dates are fixed to the example week beginning 28 September 2026. Homework and
the existing production onboarding popup are outside this decision demo.

## Validation and verdict

TypeScript and targeted lint/format checks plus an iOS Metro bundle are checked
as part of the demo handoff. The initial Today screen now renders on the native
simulator (28 September 2026). The initial startup failure was an address mismatch:
Metro listened on IPv6 localhost but advertised an unreachable IPv4 127.0.0.1
bundle URL. The demo command now explicitly advertises localhost, verified in
the Expo manifest and by relaunching the app and inspecting its screenshot.
The first-run Expo developer-menu hint still needs closing with Continue or X.
Device Hub automation times out, so actual interaction testing remains pending.
This is not evidence of successful usability testing. Android, VoiceOver,
large-text and dark-mode visual checks are pending.

Verdict: proposed design implemented for discussion; no product decision validated
yet. Ask learners what they would tap first, where tomorrow's work is, and where
they would find all plans before deciding on production integration.
