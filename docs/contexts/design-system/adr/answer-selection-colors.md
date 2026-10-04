# Selected answer colors

As requested in [DAY-497](https://linear.app/dayova/issue/DAY-497), exam/subject
selection and learning-session answer selection retain white checkmarks and
white answer letters on a blue gradient. Following the CodeRabbit contrast
review on 4 October 2026, these compact glyphs use the shared `selection`
gradient (`#006699` → `#0077AA`), not the lighter `primaryInteractive` gradient.
The action-button gradient remains unchanged.

White has 6.25:1 contrast at the dark stop and 4.97:1 at the light stop.
Every channel increases monotonically between these stops, so the light stop
is the lowest contrast across the interpolation. This exceeds the repository's
4.5:1 reference for small text and 3:1 for meaningful shapes in both themes.
`src/lib/selection-contrast.test.ts` checks the gradient, including intermediate
samples. This is a scoped glyph-contrast fix, not app-wide WCAG certification.

Selection rows keep the exam/subject pattern: border, accent fill, emphasized
primary label, and no shadow. Checked radio semantics and the check shape remain
unchanged. Selection never implies answer correctness. Solid cyan controls
outside this pattern retain `onPrimary`.

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
