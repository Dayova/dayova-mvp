# Open PR evidence audit — 22 September 2026

This directory records evidence captured from the exact Git commits listed below. It does not treat the consolidated simulator branch as evidence for an individual PR head.

## Capture environment

- iPhone 17 Pro simulator, iOS 26.4
- Dayova development client `de.dayova.app-dev`
- package commands run through Corepack/pnpm
- shared authenticated simulator data retained between captures
- all recordings inspected across their complete timeline with the repository's `inspect-video-evidence` workflow

## Verified evidence

| PR | Parent | Head | Before | After | Result |
| --- | --- | --- | --- | --- | --- |
| #693 | `00c5b190714ec2c4946c1190ed6078b6ed77b285` | `3ee67f8273c21578c6b1fec1ccb2ea3304a846eb` | [`before.png`](shared-parent-00c5b19/before.png), [`before.mp4`](shared-parent-00c5b19/before.mp4) | [`after.png`](pr-693/after.png), [`after.mp4`](pr-693/after.mp4) | New gradient add actions are visible on Home and Plans; Home → Plans → Settings → Home navigation completed. |
| #712 | `00c5b190714ec2c4946c1190ed6078b6ed77b285` | `f0c7bee51feb517d7e7d20d77d14822af0afe779` | [`before.png`](shared-parent-00c5b19/before.png), [`before.mp4`](shared-parent-00c5b19/before.mp4) | [`after.png`](pr-712/after.png), [`after.mp4`](pr-712/after.mp4) | Consolidated app launched and exposed Home, Plans, and Settings without a visible crash or blocking error. |

### Video coverage

- Shared before: `Coverage: 33.62-second video; 37 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.`
- PR #693 after: `Coverage: 33.17-second video; 33 full-timeline frames sampled at 1 fps (1-second interval); 3 contact sheet(s); no audio stream.`
- PR #712 after: `Coverage: 49.38-second video; 49 full-timeline frames sampled at 1 fps (1-second interval); 4 contact sheet(s); no audio stream.`

The gray floating gear visible in the captures belongs to the simulator automation tooling and is not Dayova UI.

## Product-quality review

### PR #693

- The outlined circular add action is consistent between Home and Plans.
- The blue/cyan gradient makes the primary add affordance easier to distinguish from neutral navigation icons.
- The 48-point target remains visually separated from nearby headings and cards.
- No clipping, overlap, unreadable label, or broken navigation was observed in the captured iPhone path.

### PR #712

- Home, Plans, and Settings preserve a consistent navigation shell and typography hierarchy.
- The dashboard card carousel intentionally exposes the next card; no content-critical clipping was observed.
- Settings rows and learning-related destinations remain readable and reachable.
- This is a representative integration review, not proof for feature-specific flows such as gallery permissions, large uploads, fresh-account onboarding, or destructive account deletion.

## Remaining PR-specific blockers

The following PRs do not yet satisfy the repository's four-artifact and product-review policy. They must remain draft until their exact head and required observable states are captured.

| PR | Missing evidence or external prerequisite |
| --- | --- |
| #700 | Exact-parent and exact-head terminal/build recordings plus screenshots of the Xcode build-phase warning/failure before and clean build after. |
| #662 | Exact-parent and exact-head recordings/screenshots of the Expo configuration contract run under the constrained scenario addressed by the PR. |
| #661 | Authenticated destructive account-deletion flow against an isolated disposable account; the current shared account must not be deleted for evidence. |
| #656 | Real 8–25 MiB document selection, upload, registration, processing, and visible completion state. A suitable non-sensitive fixture and backend processing run are required. |
| #655 | Existing stills cover personal-subject storage/navigation, but exact-parent and exact-head recordings of Settings → Personal subjects → picker usage are missing. |
| #653 | Existing iPhone/iPad before/after stills are attached to the PR; before/after recordings and resolution of the iPad artwork-overlap hold are missing. |
| #652 | Real photo-library single/multiple selection, permission-denial recovery, uploaded state, and continuation; Android coverage is also explicitly required by the PR checklist. |
| #651 | Existing before and partial-after stills are attached; fresh-account proposed defaults, post-knowledge-check reminder, before/after recordings, and Android coverage remain missing. |

Screenshots or recordings of unrelated onboarding screens are not accepted as substitutes. Evidence is only marked complete when it exercises the changed behavior on the exact relevant commit.
