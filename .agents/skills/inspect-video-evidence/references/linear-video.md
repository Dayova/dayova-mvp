# Linear Video Acquisition

Read this reference when a Linear issue, comment, or attachment contains video
evidence.

## Embedded videos

Linear commonly stores an uploaded recording inside the issue description as:

```html
<linear-embed node-type="video">{"src":"https://uploads.linear.app/..."}</linear-embed>
```

The semantic issue response contains the current signed `src`; the normal
attachment list may contain only the synced GitHub issue and omit the video.

1. Fetch the full Linear issue immediately before acquisition.
2. Parse the JSON payload inside the video embed and take its `src` value.
3. Create a unique OS-temporary directory and download the URL there with an
   ordinary authenticated-capable HTTP client such as `curl --fail --location`.
4. Keep the signed URL only in the download process argument. Preserve neither
   the URL nor its query string in files, comments, logs, manifests, or final
   responses.
5. If the server returns HTTP 403, refetch the issue for a fresh signed URL and
   retry once. Report acquisition as blocked if that retry also fails.

Use a neutral local filename such as `evidence.mp4`; keep the original media
extension when it is known. Pass the local path—not the URL—to
`inspect_video.py`.

## Linked or local recordings

- For a normal Linear attachment, download the attachment into the OS temporary
  directory before inspection.
- For a user-provided local path, inspect that file directly; generated evidence
  still belongs in an OS-temporary directory unless the user requests otherwise.
- Treat screenshots and poster frames as separate still-image evidence. They can
  guide focused inspection but do not provide temporal coverage.

## Privacy and cleanup

Issue recordings may contain private learner or company data. Keep media and
derived frames on the local device. Use no external transcription, vision, or
storage service unless the user explicitly authorizes that provider. Remove
temporary media and derived artifacts when they are no longer needed.
