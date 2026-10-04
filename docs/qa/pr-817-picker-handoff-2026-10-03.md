# PR #817: quicker time-picker handoff

Philipp reports that time selection now works, but takes too long to appear.
Scope: the transition from the learning-time editor's start/end field to the
picker; no change to the onboarding logic in #813 or subjects in #816.

The editor previously used the default sheet dismissal before presenting the
picker. It now requests a 120 ms outgoing timing animation. The native dismissal
callback remains the gate for opening the picker; no overlapping modal or
timeout-based presentation is reintroduced. Normal cancellation, saving and
deletion retain default dismissal. Draft values and the return path are unchanged.

Validation:

- Frame regression reproduced red (dismiss received no configuration rather than
  `{ duration: 120 }`), then green. Completion is not emitted before native dismissal.
- Editor regression reproduced red (default transition), then green; picker still
  waits for dismissal, edits the draft and saves the selected time.
- Full Jest UI suite: 80 suites / 367 tests pass.
- TypeScript, scoped ESLint and diff whitespace check pass.
- Scoped review: optional frame parameter leaves existing callers unchanged;
  no backend, data-model, or onboarding changes.

Limit: these tests verify animation configuration and lifecycle ordering, not
native frame timing. No new device/video timing measurement or CodeRabbit approval
is claimed. The 120 ms value is the outgoing animation setting, not total
tap-to-interactive latency.

## Follow-up: native callback regression

The first speed-up incorrectly moved the pending picker target from a ref to
state alone. A native dismissal callback retained from presentation then saw no
pending target and closed the editor instead. This was reproduced on the shared
Review iPhone: edit opened, pressing start returned to the overview, and the
`Uhrzeit auswählen` assertion failed. A retained-callback component test also
failed (unexpected `onClose`).

The pending target is now also held in a ref consumed synchronously by dismissal;
state only supplies the outgoing animation setting. The same native test passes
with the 120 ms handoff unchanged. Follow-up native test changed start from 17:00
to 18:00, returned to the editor, opened and closed the end picker, verified the
draft still contained 18:00, then closed without saving. Stored Monday 17:00–18:30
remained unchanged. No production data mutation was performed.

This is an interaction/state check, not a video-based animation-timing measurement.
The initial mocked lifecycle tests did not model retained native callbacks; the
new regression test does. TypeScript and scoped ESLint pass.
