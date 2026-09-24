# Combined QA simulator — 2026-09-24

## Pinned scope

- Existing QA integration #720: `52568c261d530d166563c9592dd9178a74cc4469`.
- Popup changes #726 and #727: merge parent `c7dec5c33c5009140555dee08a2ce3c5a9fe6a91`.
- Learning podcasts #717 are explicitly excluded by the user.
- This is a QA integration, not a production release or blanket acceptance of each PR.

Conflict resolution preserves the existing QA material retry action, account-deletion password input and disabled confirmation, sheet-aware keyboard inputs, analytics provider, and optional-learning-time flow. Popup sizing and header spacing come from #726/#727; the handle remains visible and destructive buttons use an outlined tinted treatment without icons.

## Validation

- TypeScript: `tsc --noEmit` passed.
- UI tests: 84 suites, 392 tests passed.
- Biome check passed for changed TypeScript/CSS files.
- iOS and Android Metro bundles built successfully from the combined worktree.
- iPhone QA displayed the signed-in dashboard; Android displayed the welcome screen (signed out).
- This startup check does not claim a fresh end-to-end test of every integrated feature.

## Local runtime

Worktree: `/private/tmp/dayova-qa-popups`.
Branch: `codex/qa-popup-integration-20260924`.
Metro: port **8110**, development client, `APP_VARIANT=development`.
Use the existing QA public environment configuration; no secrets are committed.
QA backend remains `trustworthy-skunk-257`; no backend or production deployment was performed.

Start Expo from this worktree with `--dev-client --port 8110 --clear` when switching branches. A reused Metro transform cache initially pointed Expo Router at the old standalone popup worktree; clearing that cache fixed bundling. Do not start the standalone #727 worktree when the combined QA version is wanted.

Development-client URL: `exp+dayova://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8110`.
Android requires `adb reverse tcp:8110 tcp:8110`.

Existing popup visual evidence is in [popup-design-2026-09-24](popup-design-2026-09-24/README.md); those images document the popup fixture run, not this combined dashboard startup.
