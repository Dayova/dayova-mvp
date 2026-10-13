# DAY-486 — Notification evidence

Source under test: `21a136accecb38cc4a397118d28592e09ab250a0` ([PR #855](https://github.com/Dayova/dayova-mvp/pull/855)).
Captured/tested 13 October 2026.

## Automated verification

The relevant suites were rerun for this evidence capture:

- [Vitest output](vitest.txt): 5 suites, 73 passing tests.
- [Jest output](jest.txt): 3 suites, 11 passing tests.

Commands (from the PR worktree):

```sh
node node_modules/vitest/vitest.mjs run convex/notifications.test.ts convex/preparationPlanning.test.ts src/lib/notification-planner.test.ts src/lib/notification-preferences.test.ts src/lib/local-notification-scheduler.test.ts
node node_modules/jest/bin/jest.js --runInBand src/components/notification-sync.ui.test.tsx src/components/learning-reminder-offer.ui.test.tsx src/features/learning-plans/preparation-screen.ui.test.tsx
```

These cover independent start reminders, retained legacy preferences, suppression after starting, deduplication, empty-day suppression, owner-scoped notification registration/opening, safe fallbacks after deletion, and the current preparation-slot editor. A failed reschedule rolls back the engagement timestamp; a successful changed schedule records it. Component tests cover cold/warm responses, waiting for authentication/navigation, permission-offer actions and opening the slot editor from its route parameter.

The implementation pass additionally ran all 137 Vitest suites (1,077 tests), 5 selected UI suites (23 tests), TypeScript, Biome and ESLint successfully. The outputs linked above are the smaller, fresh evidence run.

## Native capture setup

An installed Dayova development client on the local iOS 26.4.1 simulator renders the real PR components. A temporary entry point supplies the normal native safe-area, keyboard, theme and bottom-sheet providers. Resolver fixtures replace authentication, Convex queries/mutations, routing and notification permission responses. All shown learning content is synthetic; no backend is connected and no user data is changed.

Consequently, this capture can establish component appearance and local control interactions. It cannot establish server persistence, system permission prompts, OS notification delivery or authenticated end-to-end navigation. The temporary entry point and resolver changes are not part of the shipped app. The capture-only [entry point](app.tsx.txt) and [fixtures](fixtures.tsx.txt) are archived as text for inspection; they must not replace the production entry point. The temporary Metro resolver mapped `convex/react`, `expo-router`, `~/context/AuthContext` and `~/lib/notification-permissions` to the fixture module, with the normal NativeWind/SVG configuration retained.

## Screenshots and observed interactions

These are actual simulator captures, cropped only to the device frame. The development-client gear is tooling, not production UI. They are still images, not proof of animation timing or push delivery.

| Capture | Observation |
| --- | --- |
| [Defaults](ios-settings-default.png) | Daily overview and pre-reminder are off; start reminder is on. |
| [Independent switches](ios-settings-independent.png) | After tapping the two switches, pre-reminder is on while start reminder is off. |
| [Remaining reminders](ios-settings-reminders.png) | The 15-minute offset and missed-appointment switch are reachable by scrolling. |
| [Offset picker](ios-offset-picker.png) | 5, 10, 15, 30 and 60 minutes are offered; 15 is initially selected. |
| [Changed offset](ios-offset-changed.png) | Selecting 30 dismisses the sheet and updates the displayed value to 30 min. |
| [Inbox](ios-inbox.png) | Synthetic missed/start/pre-reminder examples use the production title/body copy. “Neu planen” and “Öffnen” are visible. The long start-reminder heading is truncated by the existing one-line title layout; its body and action remain visible. Navigation from these fixture cards was not verified. |
| [Reminder offer](ios-reminder-offer.png) | Real confirmation sheet renders with both actions and complete explanatory text. Tapping “Später” dismissed the sheet. The background is the test launcher, not a learning-plan screen; OS permissions are stubbed. |

The fixtures are in-memory and reset on bundle reload. Control interaction evidence therefore establishes rendering and component behavior, not durable backend persistence. Light appearance/default text size only; dark mode, large text and screen readers were not inspected. The scrolled settings content can appear behind the status-bar region in this isolated host; root-navigation chrome is absent, so full-app safe-area behavior is not established here.

## Required end-to-end acceptance run

Use a development build connected to a non-production backend and a test account on a physical device:

1. Create an unfinished learning appointment, allow notifications, enable the 15-minute pre-reminder and start reminder. Background the app; observe both at their actual times.
2. Leave a second appointment unstarted. After its scheduled end plus 15 minutes, open the reminder and confirm the correct preparation slot is editable. Save a changed date/time and inspect the engagement record.
3. Start or complete an appointment before the recovery reminder; verify the obsolete reminder is cancelled after the device sync.
4. Move and delete future appointments; verify the device queue contains only the updated plan after sync.
5. Repeat a tap after terminating the app, with authentication required, and with the referenced appointment deleted. Confirm safe routing without duplicate opens.
6. Toggle the independent settings and verify scheduled notifications follow each preference. Check Android as well as iOS.
7. Julius records whether reminders are helpful and produce return to the learning plan.

These items remain open. Simulator component screenshots and passing unit tests do not replace them. The implementation uses local OS scheduling (14-day horizon, at most 60 learning reminders), so changes made on another device require a subsequent sync on the receiving device.
