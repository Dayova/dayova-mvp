# DAY-393: verified simulator comparison

Captured on 2026-09-25 (Europe/Berlin), for PR #657.

## Source and runtime identity

- Before: `b93db949b10bb3e30b3b609ba895d91bf7013073`, clean tracked files in the `evidence-before` worktree; dedicated Metro port 8089.
- After: `412ed341df525b7e287540539910c2419771c9eb`, clean tracked files in `/private/tmp/dayova-657-after-capture`; dedicated Metro port 8090. Only the dependency symlink was untracked before capture.
- Both used the same installed `de.dayova.app-dev` native client (CFBundleVersion 1), simulator `Dayova Jakob Review iPhone`, UUID `47731F12-CE91-4857-8F3A-799040A0DCA3`, iOS 26.4, 1206 × 2622 pixels, light appearance.
- Each runtime was opened using the Expo development-client URL containing its dedicated port. Each Metro `/json/list` returned the matching app/device and debugger URL on that port (before page 2, after page 3). Both Metro logs confirmed a completed iOS bundle of 8108 modules before the accepted captures.
- Navigation used the same `dayova://notification-settings` route. No notification preferences were changed. The same account, native binary, backend, and top-of-page position were retained.
- This is a comparison of the exact JS/source revisions in one native development client, not two separately rebuilt native binaries or production OTA verification.

## Observed result

Before: pronounced gray shadows around the delivery and notification-category cards.
After: those shadows are absent, replaced with thin pale outlines. The back button also gains a thin outline. Card content and switch states are the same; small geometry changes follow the added borders.

The floating gray gear and its shadow are a test overlay, not a Dayova card; they remain in both original captures.

| Before | After |
| --- | --- |
| [Original PNG](notifications-before.png) | [Original PNG](notifications-after.png) |

## Integrity and limits

These PNGs are unmodified `xcrun simctl io ... screenshot` output. No generated, reconstructed, cropped, or retouched evidence is included.

- `notifications-before.png` SHA-256: `1448d073719b26ec94bd6807c96b7a69d56cc1bef852f40761c95f963b65470b`
- `notifications-after.png` SHA-256: `2bb49b39d7721e1c644f4d5798a1962688fab27cdb8b1fb77473a25b505dba50`

This pair establishes the visible shadow change on this iOS light-mode screen. It does not claim Android, dark mode, every affected screen, notification delivery, or new end-to-end functional coverage. The earlier settings/learning-time pairs remain unsuitable as proof of shadow removal. No application code or backend was changed for these captures.
