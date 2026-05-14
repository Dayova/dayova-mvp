# Bottom Sheets

This app uses `@gorhom/bottom-sheet` for interactive picker sheets such as the
subject and exam-type selector.

## Why not Expo UI for these sheets?

`@expo/ui/community/bottom-sheet` is API-compatible with
`@gorhom/bottom-sheet` where the native platform behavior allows, but it is not
gesture-equivalent for scroll-heavy sheets.

Expo UI's bottom sheet delegates gestures to platform primitives:

- Android: Jetpack Compose `ModalBottomSheet`
- iOS: SwiftUI sheet presentation
- Web: `vaul`

Its scrollable exports are React Native scrollables, and several Gorhom-style
gesture props are accepted for API compatibility without changing behavior. In
practice, `enablePanDownToClose` can make the native sheet consume vertical drags
that should belong to the inner option list. Disabling it fixes list scrolling,
but removes drag-to-close.

Gorhom owns the gesture and animation layer through Reanimated and React Native
Gesture Handler, and its scrollable components coordinate sheet panning with
inner list scrolling. That is the behavior the picker sheets need.

Sources:

- Expo UI BottomSheet docs: https://docs.expo.dev/versions/v56.0.0/sdk/ui/drop-in-replacements/bottomsheet/
- Gorhom Bottom Sheet docs: https://gorhom.dev/react-native-bottom-sheet/

## What would need to change before switching back to Expo UI?

Switch these picker sheets back to Expo UI only after Expo UI supports
scroll-aware sheet/content gesture coordination equivalent to Gorhom for this
case:

- The sheet must allow drag-to-close without stealing normal vertical scrolling
  from a nested `BottomSheetScrollView`.
- Moving the sheet slightly must not leave the nested scroll view unable to
  scroll afterward.
- Expo UI must expose effective controls for content panning vs handle/sheet
  panning, or otherwise make nested React Native scrollables coordinate reliably
  with the native sheet gesture.
- Custom backdrop/handle behavior used by this app must either be supported or
  have an acceptable native equivalent.

When those conditions are met, the migration path is:

1. Replace imports from `@gorhom/bottom-sheet` with
   `@expo/ui/community/bottom-sheet`.
2. Remove `BottomSheetModalProvider` from `src/app/_layout.tsx` if no remaining
   Gorhom sheets need it.
3. Remove `GestureHandlerRootView` only if no other Gesture Handler components
   need it.
4. Remove `@gorhom/bottom-sheet` and `react-native-gesture-handler` from
   dependencies if they are no longer used.
5. Re-test picker sheets on Android and iOS with long option lists.
