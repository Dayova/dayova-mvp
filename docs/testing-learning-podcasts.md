# Learning podcast experiment (DAY-468)

This is Philipp's local product experiment, **not a feature of the Dayova app**.
The normal app has no podcast entry point, backend, AI generation, data storage,
or learning-plan integration. The sample audio was generated locally with system
voices; it is not evidence of future voice quality.

Run `pnpm podcast:preview` and open the development client in the iOS simulator.
If the native client does not include `expo-audio`, rebuild it with
`pnpm expo:ios -- --no-bundler`. The preview starts only when `__DEV__` is true
and `EXPO_PUBLIC_PODCAST_PREVIEW=1` is set. Run `pnpm expo:start` without the
flag to return to the normal app. No credentials or backend deployment are needed.

Test play/pause, 15-second rewind, speed, transcript, three sequential
questions, feedback, summary, and restart. The optional smoke flow is
`.maestro/podcast-preview.yaml`; launch the preview first, then run
`maestro --platform ios test -e APP_ID=de.dayova.app-dev .maestro/podcast-preview.yaml`.
Set `APP_ID` to the simulator build's identifier if different.

`node scripts/generate-podcast-preview.mjs` regenerates the fixture on macOS
with `say` and `ffmpeg`. Its content is fixed and does not read a learning plan
or write user data. A future app integration needs a separate product decision,
privacy/backend review, and validation; this draft is not approval to ship it.
