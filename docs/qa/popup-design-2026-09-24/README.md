# Popup header and destructive-action design evidence

## Isolated review (1 October 2026)

PR #727 is rebased as a focused patch on `main` at
`a553f8f3a1c0999929803b4815b7ea0c932ab2db`. Its merged former parent #726 is no
longer a separate dependency. No new design decision is introduced here.
The superseded wide learning-plan delete rail is intentionally omitted: the
later approved trash-icon restoration (#737) is already on main and preserved
byte-for-byte. The dashboard's documented Today-button exception also remains.

The screenshots and native observations below are historical September evidence,
not fresh acceptance of this isolated branch. No native replay, deployment, OTA,
or paid build is claimed. The PR stays Ready for Review.

Current isolation validation: TypeScript, seven theme tests, 30 UI tests across
five suites, targeted ESLint/Biome and diff checks passed. ESLint skips the
Tailwind config by configuration (no source errors). Independent Standards and
Spec reviews found no blocking issues. Native acceptance limits below remain.

Date: 2026-09-24. Base: PR #726, `dcb4787691a3c92e7906763b53d173cd1bcfb988`.

User-approved design: close control above the full-width title, preserve the grey drag handle, use tinted/outlined red destructive pills without decorative icons. Shared tokens preserve the existing status/error colors.

## Native evidence (after)

These are actual simulator captures of the changed `DayovaSheetFrame`, `ConfirmationSheet`, and `Button` components in a temporary, backend-free gallery. The gallery used local Poppins fonts and the app's theme/safe-area/bottom-sheet providers. Its planning choices are simple fixture buttons, not the production planning-choice cards. The gallery and temporary entry-point change were removed before commit.

| iOS simulator | Android emulator |
| --- | --- |
| ![Planning header](ios-planning.png) | ![Planning header](android-planning.png) |
| ![Destructive confirmation](ios-delete.png) | ![Destructive confirmation](android-delete.png) |

Observed: grey handle retained; X above title; full-width title/description; red outlined, tinted delete action with readable wrapping and no icon. No real account, plan, or material was deleted. The floating gear belongs to the development environment.

## Coverage and remaining acceptance

- TypeScript and targeted ESLint/Biome checks.
- Shared-sheet tests cover separate close/title rows at font scales 1 and 2, along with existing sheet behavior tests.
- Theme unit tests enforce destructive foreground/fill contrast of at least 4.5:1 in light and dark themes.
- Targeted UI suites: shared sheet, timetable editor, paywall, profile, and material-required sheet.
- Native dark-mode and enlarged-system-font attempts did not yield usable dialog captures; they are **not** claimed as passed.
- Busy/error rendering, VoiceOver/TalkBack traversal, iPad, every individual destructive-action surface, and authenticated end-to-end delete behavior are **not** certified by these screenshots.
- No before image has been fabricated. User-provided references are design inputs, not a captured baseline build.
- Historical capture: not merged or deployed; originally a follow-up to #726.

## Review

The code review checked that callbacks, confirmation guards, and disabled/busy semantics remain intact, that the app entry point is restored, and that the production changes contain no fixture backend behavior. Material-card content was regrouped into an icon/name row with a separate text action to avoid collapsing the filename area.
