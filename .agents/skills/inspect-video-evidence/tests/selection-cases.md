# Selection Cases

Use these prompts to check model invocation after changing the skill catalog or
the triage overlay.

## Must invoke

| Prompt | Expected path |
| --- | --- |
| `Triage DAY-167.` | Triage fetches the issue, detects the video embed, then invokes `$inspect-video-evidence`. |
| `Inspect the recording attached to DAY-167.` | Invoke `$inspect-video-evidence` and the Linear acquisition branch. |
| `Diagnose this .mov recording.` | Invoke `$inspect-video-evidence` before temporal diagnosis. |
| `What happens between 00:08 and 00:12 in this video?` | Generate full coverage first, then a focused interval. |

## Must not invoke

| Prompt | Expected path |
| --- | --- |
| `Generate a marketing video.` | Use image/video generation capabilities, not evidence inspection. |
| `Fix this screenshot-only layout bug.` | Treat the screenshot as still-image evidence. |

## Success checks

- Full-timeline sampling precedes focused inspection.
- Every contact sheet is inspected.
- Temporal claims carry timestamps and the coverage statement.
- Missing dependencies stop verification with installation guidance.
- An expired Linear URL causes one issue refetch and one retry.
- Poster frames and isolated screenshots are described as still-image evidence.
