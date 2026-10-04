# Selection colors and motion

The user's device review on 5 October 2026 supersedes DAY-497's 4 October
contrast correction: dark blue (`#006699` → `#0077AA`) is not the Dayova selection
palette. `selection` now aliases the canonical `primaryInteractive` gradient
(`#00A0E6` → `#4FD8FF`), so buttons and selections cannot drift apart.

Use fixed `onPrimary` (`#1A1A1A`) for selected checkmarks, answer letters and pill
labels in both themes. The bright gradient with white small text would have
insufficient contrast; changing the foreground preserves the requested brand
colors. `src/lib/selection-contrast.test.ts` checks all intermediate samples
against 4.5:1. This is a scoped contrast check, not app-wide certification.

Decision brief:
- Job: choose an answer, subject, exam type or schedule value confidently.
- Hierarchy: prompt, choices and checked state, then the separate continue action.
- Primary action: choose immediately; submit only with the existing CTA.
- Friction: eliminate inconsistent dark-blue markers and abrupt state changes.
- Decision: reuse PR #694's shared controlled-selection motion on current main,
  preserve current layouts, and apply the canonical gradient to markers/pills.

`SelectionControl` now covers answer lists, exam/subject rows, selection sheets,
onboarding/recovery choices and learning-time/timetable weekdays. State changes
are immediate, with 180 ms color/opacity transitions, a small press scale and a
240 ms settling spring. The outer hit target stays fixed. Reduced motion skips
these animations. Indicator slots stay mounted and labels wrap without line caps.
Answer badges grow with text scaling. A selected answer is not a correctness state.

Already animated gradient controls (theme toggle, duration carousel and segmented
navigation) retain their specialized motion. Subscription cards retain their
separate translucent payment appearance and existing selection motion. Native
switches and date/time pickers retain the documented native wrappers.

PR #694 also contains payment-footer work; that unrelated change is not included
here. Its overlapping selection migrations must use this implementation when
that PR is reconciled, rather than restoring its older colors/layouts.

## Historical rationale


Retain `onPrimary` on solid `primary` for selected answer letters and checkmarks
in both themes, and keep answer content in `text`. This gives the compact glyphs
7.85:1 contrast, versus 2.22:1 for the original white, without introducing a new
selection hue; selection must not imply correctness. The cyan outline is
supplementary to the contrasting check shape and checked radio state.

The [canonical decision and alternatives](https://app.notion.com/p/3da2e87228bf8173b2adddaab6e3f5e6)
record why white on a darker blue is viable but not preferred, the native
comparison, limitations, and reversal conditions. Implementation evidence lives
in [PR #586's color comparison](../../../evidence/pr-586/color-decision/README.md);
[DAY-408](https://linear.app/dayova/issue/DAY-408/polish-answer-selection-motion-and-document-the-selected-color)
tracks review. This retains the PR implementation; it does not assert app-wide
accessibility conformance or release readiness.
