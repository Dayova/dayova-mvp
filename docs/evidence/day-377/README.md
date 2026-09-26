# DAY-377: native back interception

PR: https://github.com/Dayova/dayova-mvp/pull/494

## Cause and change

A raw `beforeRemove` listener updated the exam's internal step and prevented
JavaScript removal after iOS had already popped the native creation screen.
The native stack then reported that `(creation)` remained in JS state after
native removal.

`useBackIntent` now registers with `usePreventRemove`, so prevention reaches
the native parent stack before a swipe. It remains active only while the screen
is focused and the current step or picker consumes Back. First-step exits remain
unblocked; non-back removals and unhandled back actions resume the original
action through React Navigation's replay mechanism.

## Automated regression

`src/lib/navigation-native-guard.ui.test.tsx` exercises real nested routers and
the prevention context consumed by native-stack. On the old hook it fails with
`Expected: protected; Received: unprotected`. With the change it verifies that
an internal Back returns one step, protection clears at the exit boundary, and
the next Back reaches Home. It also verifies deliberate route replacement.

The hook tests cover queued header/Android exits, duplicate Back within one
frame, no-history fallback, unhandled actions, replacements and focus gating.

Validation: TypeScript, Biome/ESLint on changed files, all 118 Vitest files
(764 tests), and all 67 Jest UI suites passed. The UI suites were run in bounded
batches after the single-process full run stalled between suites; the stalled
suite and all remaining suites passed in fresh processes.

## Native verification

Tested on 2026-09-21, based on PR head `a769829` plus this navigation change.
The same native fixture reproduced the error with the old hook and passed the
[full gesture sequence](ios-gesture-regression.yaml) with the fix. See the
[assertion log](ios-gesture-results.log) and [runtime/source hashes](ios-runtime.json).

- Initial exam type: header Back exits to Home.
- Initial exam type: real left-edge swipe exits to Home.
- Klausur selected: real left-edge swipe exits to Home.
- Subject step: header Back returns to exam type, retaining Klausur.
- Subject step: real left-edge swipe returns to exam type; Home stays hidden.
- Subsequent header Back exits to Home. No native/JS desynchronization error appears.

Maestro 2.9.0 issued 450ms swipes from 1%,50% to 95%,50%. The YAML targets the
isolated fixture's Home screen; it is evidence of the recorded run, not an
unauthenticated production smoke flow. To repeat manually in the authenticated
app: open exam creation, select Klausur, continue to subject, swipe back, verify
the exam-type screen, then exit.

### Runtime limits

DAY-169 iPhone 16 simulator, iOS 26.5; installed dev app 1.0.4 build 1. Real
native tabs/stacks and unchanged PR exam/layout components were used with
isolated auth/data/analytics and a fixture Home. No backend reads or writes.
The fixture calls `enableLayoutAnimations(false)` to avoid a rendering issue
that also occurred with the old hook; native UIKit gestures remain enabled.
Metro reloads were disabled for the recorded run. These fixture adjustments
are local only and are not app changes.

Router 57.0.19 and Screens 4.26.2 match the PR. The installed native runtime
uses RN 0.86.0, Expo 57.0.8, Reanimated 4.5.0 and Worklets 0.10.0; the PR lockfile
has RN 0.86.3, Expo 57.0.20, Reanimated 4.5.1 and Worklets 0.10.1. This is a
native integration pass, not an exact-release-build or full authenticated E2E
pass. Android verification and final lockfile-matched build verification remain
pending. Review readiness is managed separately from these verification results.

### Recording inspection

The attached PR recording shows header exit at 21–22s, unselected swipe exit at
25–27s, selected swipe exit at 31–32s, subject/header back at 37–39s, and the
subject swipe at 40–42s. At 41s the native screen slides; at 42s the exam-type
screen is restored with Klausur retained. It stays visible through 44s before
the final header exit reaches Home at 45s. Home remains stable through the end.
These are observations from sampled frames, corroborated by Maestro assertions
and the runtime log. No claim about every gesture speed or cancellation threshold.

Coverage: 65.51-second video; 65 full-timeline frames sampled at 1 fps (1-second interval); 5 contact sheet(s); no audio stream.

All five contact sheets and individual frames at 40–42s were inspected. No
transcription was needed. Subsecond details between the sampled frames were
not evaluated. Recording SHA-256:
`f02498cb05241be9b8aa5028e8a3de183d6b7932db2d0b671c90a8628a70b64c`.
