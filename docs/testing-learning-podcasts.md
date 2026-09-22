# Learning podcast test guide (DAY-468)

This branch is stacked on `codex/consolidate-app-work-20260922` (PR #712).

## Local iOS preview

Run `pnpm podcast:preview`, then open the development client in the iOS simulator.
If the client needs a native rebuild, use `pnpm expo:ios -- --no-bundler`.
The preview is a separate development-only component harness, not an authentication bypass.
It uses the production player and study components with a clearly labelled sample dialogue
and local macOS system voices. It makes no AI calls and writes no learning-plan data.
Use `pnpm expo:start` without `EXPO_PUBLIC_PODCAST_PREVIEW` to return to the real app.

Test playback/pause, 15-second rewind, speed and the optional transcript. No questions
are visible during listening. After audio ends, continue explicitly to three questions,
one per screen; select an answer, check it, read feedback and move on. Verify the final
summary and replay. The local sample is about one minute;
generated episodes target 3–6 minutes. `node scripts/generate-podcast-preview.mjs`
regenerates the sample on macOS with `say` and `ffmpeg`.

The optional UI smoke flow is `.maestro/podcast-preview.yaml`; launch the preview first,
then run `maestro --platform ios test -e APP_ID=de.dayova.app-dev .maestro/podcast-preview.yaml`.
Set APP_ID to the installed simulator build's identifier when it differs.

## Real generation

The dev deployment is `trustworthy-skunk-257`; production has not been deployed.
Configure `GOOGLE_VERTEX_API_KEY` securely in the development dashboard, or configure
`GOOGLE_VERTEX_PROJECT` with working Google application credentials. Do not paste secrets
into issues, PRs, or chat. Optional overrides: `GOOGLE_VERTEX_LOCATION`,
`GOOGLE_VERTEX_FLASH_MODEL`, `GOOGLE_VERTEX_TTS_MODEL`.

Sign into the normal app, open a language-subject learning plan with prepared theory,
and choose **Als Podcast anhören** from theory or the plan's session preview.
Unknown custom subject names require explicit confirmation that they are language subjects.
Grant AI processing consent and create the episode. Verify two voices, source grounding,
transcript fidelity, questions, linked materials, persisted resume, and lock-screen playback.
Listening and podcast questions must not complete the session or change mastery.

Generation is not live-verified until credentials are present. The local sample is not
evidence of Vertex quality, transcript alignment, or real generation latency.

## Validation and review gaps

Automated backend and component tests cover ownership, consent, stale source rejection,
custom language confirmation, progress bounds, comprehension, and playback controls.
A separate Dayova product-quality review and all four required before/after PR media
artifacts are still required before this draft can be marked ready.
