# QA integration of native entry history

Integrates PR #698 into the combined QA base from PR #720. This is a review
candidate, not a production release or a completed device acceptance test.

## Conflict resolution

- Preserve the QA exam flow: exam type → subject → date → topics. Do not
  reintroduce the former mandatory learning-availability step.
- Preserve personal subject IDs in the shared draft and topics handoff, along
  with analytics, error recovery, saved exam identity, and duplicate-save gate.
- Resume current `step=basics` and legacy `step=learningAvailability` URLs at
  Date with real Subject and Exam type predecessors.
- Disable the native removal gesture while a picker/sheet or save is active.
- No backend, deployment, Clerk, or podcast changes.

## Validation

- TypeScript `tsc --noEmit`: passed.
- Biome checks for changed TypeScript files: passed.
- ESLint for entry routes, entry feature, and creation-flow test: passed.
- Complete Jest UI run: 83 suites, 383 tests passed.
- Creation-flow suite rerun: 15 tests passed, including personal subject ID
  handoff, current and legacy resume, Back/answers, and save failure recovery.
- Manual diff review against the previous QA form: completed.

## Not yet verified

The desktop device-control interface timed out. No new iPad, iPhone, or Android
screenshots or native swipe recordings were obtained for this integration.
Evidence inherited under `entry-native-stack` is historical evidence for #698,
not acceptance evidence for this combined branch. Native swipe cancellation,
root-step exit, and OS-killed cold-link smoke tests remain required before this
draft can be treated as accepted. The iPad profile-field overflow is a separate
open item. AI generation remains blocked on the intended QA Vertex configuration;
Clerk account deletion remains outside this change as requested.
