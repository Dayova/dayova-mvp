# ADR: Select List Components By Workload

- Status: Accepted
- Date: 2026-07-13

## Context

React Native's `ScrollView` and `FlatList`, Shopify's FlashList, and LegendList
can all implement horizontal paging or scrollable collections. They optimise for
different workloads, however. Choosing the most specialised list everywhere
would add dependencies and recycling behaviour without necessarily improving
the learner experience.

The onboarding intro currently contains exactly three fixed-width, full-screen
pages. It needs native paging, imperative next/back navigation, and continuous
Reanimated scroll progress for its page indicator and control positions. It is
not a long or dynamically growing list.

## Decision

Select the least specialised component that satisfies the measured workload:

1. Use `Animated.ScrollView` for new, small, permanently bounded pagers or
   collections whose children can safely render together. This is the preferred
   greenfield choice for a three-page onboarding carousel because virtualization
   provides no benefit.
2. Use `FlatList` as the core default for dynamic collections when its built-in
   virtualization and standard React Native API are sufficient. Fixed item
   dimensions should use `getItemLayout` when applicable.
3. Consider FlashList only for a large or expensive list where release-build
   profiling demonstrates that FlatList rendering, blank areas, or memory usage
   is a real problem. Its recycling model requires item-local and animated state
   to be reset correctly when a cell is reused.
4. Consider LegendList for a large feed or chat workload that benefits from its
   advanced scroll anchoring, bidirectional growth, dynamic sizing, or dedicated
   Reanimated integration. It must still outperform the core alternative in a
   representative release-build benchmark before adoption.

Do not add FlashList or LegendList solely to standardise on a fashionable or
nominally faster list implementation. When either third-party library is
proposed, document the failing workload, benchmark the relevant device class,
and cover scrolling, restoration, and recycled-cell state with regression
tests.

## Onboarding Pager Decision

Keep the existing onboarding pager on `Animated.FlatList`.

It already uses three stable keys, exact page-width `getItemLayout` values,
`pagingEnabled`, `scrollToOffset`, and a Reanimated `onScroll` handler. Replacing
it now with `Animated.ScrollView` would be a cleanup-only refactor with no
meaningful performance or correctness benefit. Replacing it with FlashList or
LegendList would add a dependency and a more complex rendering model without
solving a problem present in this three-item dataset.

If the onboarding pager is rebuilt substantially while it remains permanently
bounded to a few pages, prefer `Animated.ScrollView`. If it evolves into a
dynamic or remotely configured collection, re-evaluate `FlatList` first before
considering a third-party list.

## Consequences

- React Native core components remain the default and no third-party list
  dependency is added for onboarding.
- Small pagers favour simple eager rendering; dynamic lists favour FlatList's
  core virtualization.
- FlashList and LegendList remain valid targeted optimisations, not forbidden
  libraries.
- List-library adoption requires evidence from release builds rather than
  development-mode impressions or generic library benchmarks.

## References

- [React Native FlatList](https://reactnative.dev/docs/flatlist)
- [React Native ScrollView pagination](https://reactnative.dev/docs/scrollview)
- [FlashList usage and recycling](https://shopify.github.io/flash-list/docs/usage/)
- [LegendList overview](https://legendapp.com/open-source/list/v3/overview/)
