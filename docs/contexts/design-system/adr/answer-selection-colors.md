# Selected answer colors

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
