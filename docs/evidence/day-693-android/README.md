# PR #693 — Android still-image comparison

Captured 22 September 2026 on the local Pixel 9 / Android 16 emulator with the installed `com.dayova.dev` development client.

| Before | After |
| --- | --- |
| `00c5b190714ec2c4946c1190ed6078b6ed77b285` | `3ee67f8273c21578c6b1fec1ccb2ea3304a846eb` |
| [Plans screenshot](before-plans.png) | [Plans screenshot](after-plans.png) |

The same authenticated Plans screen shows a black plus before and the Dayova blue/cyan plus after. The screenshot pair was visually inspected. The floating gear near the lower-right corner belongs to developer tooling, not the shipped app.

Both sources ran through separate local Metro servers (before: 8092; after: 8091). The after-state add action was also opened and the native accessibility tree exposed the choices for a new exam and a new homework entry. No entry was saved.

These files are still-image evidence for the Plans action on Android. They do not certify every changed add-action location, the other open PRs, or production OTA installation. The existing iOS before/after recordings remain linked in the PR description. Trial recordings from this follow-up are not presented as complete navigation evidence.
