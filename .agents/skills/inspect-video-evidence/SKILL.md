---
name: inspect-video-evidence
description: Inspect video evidence by probing metadata, sampling the complete timeline, generating timestamped contact sheets, and zooming into relevant intervals. Use when triaging or debugging a Linear issue with a video or screen recording, or when asked to watch, inspect, summarize, diagnose, or compare local .mp4, .mov, .mkv, or .webm files.
---

# Inspect Video Evidence

Use an evidence pass: cover the whole timeline first, then inspect important
intervals densely enough to support temporal claims.

## Steps

1. Acquire a local video file in the OS temporary directory. When the evidence
   comes from a Linear issue body, comment, or attachment, read
   [references/linear-video.md](references/linear-video.md) before downloading
   it. Completion: the local file is readable and no signed URL was persisted.

2. Run the dependency gate:

   ```sh
   python3 <skill-dir>/scripts/preflight.py
   ```

   Completion: both `ffmpeg` and `ffprobe` are available. If the gate fails,
   stop video verification, report the missing dependency, and rerun after it
   is installed.

3. Generate the full evidence set:

   ```sh
   python3 <skill-dir>/scripts/inspect_video.py <video> \
     --question "<what the task needs established>"
   ```

   Pass `--output-dir <dir>` only when a stable temporary location is useful.
   Completion: the command reports an output directory containing
   `manifest.json`, `coverage.txt`, `frame-index.md`, individual frames, and at
   least one contact sheet.

4. Read `manifest.json`, `coverage.txt`, and `frame-index.md`; then inspect every
   contact sheet with the image-viewing tool. Open individual frames around the
   relevant interaction. Completion: every full-timeline sheet has been
   inspected and each temporal conclusion has timestamped visual support.

5. If an important transition falls between samples, add a focused interval to
   the same evidence set:

   ```sh
   python3 <skill-dir>/scripts/inspect_video.py <video> \
     --question "<question>" --output-dir <existing-dir> \
     --start 7 --end 12 --fps 5
   ```

   Re-read the updated manifest, index, coverage statement, and every new sheet.
   Completion: the focused interval resolves the sampling gap or the remaining
   uncertainty is explicit.

6. Report observed facts separately from interpretations. Include timestamps,
   the verbatim coverage statement, audio/transcription status, and remaining
   sampling limits. Describe the video as watched only after complete timeline
   coverage; treat posters, Quick Look previews, and isolated screenshots as
   still-image evidence.

Keep private issue media local. Use local or company-approved transcription
only when an audio stream exists and speech matters to the task.
