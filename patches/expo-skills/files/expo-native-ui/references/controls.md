# Native Controls

Use native controls for platform behavior, accessibility, and interaction feedback. Load the `$expo-ui` skill before selecting or implementing an `@expo/ui` control; it owns the current universal, platform-specific, and drop-in replacement APIs.

Repository guidance takes precedence over generic examples. Prefer an existing shared component so screens do not duplicate host setup, colors, modifiers, test IDs, or disabled-state behavior.

## Contents

- [Dayova Switch](#dayova-switch)
- [Dayova Date and Time Picker](#dayova-date-and-time-picker)
- [Other Expo UI Controls](#other-expo-ui-controls)
- [Completion Checks](#completion-checks)

## Dayova Switch

Dayova app screens must use the shared switch wrapper:

```tsx
import { Switch } from "~/components/ui/switch";
import { useState } from "react";

function NotificationSetting() {
  const [enabled, setEnabled] = useState(false);

  return <Switch value={enabled} onValueChange={setEnabled} />;
}
```

Do not import `Switch` from React Native and do not render Expo UI switches directly from Dayova screens. The shared wrapper owns `Host`, platform differences, Dayova colors, modifiers, disabled behavior, and test IDs.

When building or maintaining a reusable wrapper in another Expo project, follow `$expo-ui` and use the universal API where it fits:

```tsx
import { Host, Switch } from "@expo/ui";

<Host matchContents>
  <Switch value={enabled} onValueChange={setEnabled} />
</Host>;
```

## Dayova Date and Time Picker

Dayova app screens must use the shared sheet wrapper:

```tsx
import {
  DateTimePickerSheet,
  type DateTimePickerEvent,
} from "~/components/ui/date-time-picker-sheet";

<DateTimePickerSheet
  visible={pickerVisible}
  value={date}
  mode="datetime"
  minimumDate={new Date()}
  onClose={() => setPickerVisible(false)}
  onChange={(event: DateTimePickerEvent, selectedDate) => {
    if (event.type === "dismissed") {
      setPickerVisible(false);
      return;
    }
    if (selectedDate) setDate(selectedDate);
  }}
/>;
```

The wrapper owns the Expo UI picker, Android/iOS display normalization, German locale, safe-area handling, and native presentation.

When building or maintaining a wrapper in another Expo project, use Expo UI's API-compatible drop-in replacement and confirm its current props in `$expo-ui`:

```tsx
import DateTimePicker from "@expo/ui/community/datetime-picker";
```

## Other Expo UI Controls

Use `$expo-ui` to choose among universal `Button`, `Switch`, `Checkbox`, `Slider`, `TextInput`, and `Picker`; community-library drop-in replacements; or platform-specific SwiftUI and Jetpack Compose trees. Confirm the current API there instead of guessing an import from an older Expo or React Native release.

## Completion Checks

- Read the repository's design-system context before choosing a control.
- Reuse the documented shared component when present.
- Do not add duplicate haptics to a control that already provides interaction feedback.
- Verify accessibility labels, disabled behavior, dark mode, and platform behavior.
- Test both iOS and Android when a wrapper has platform-specific implementations.
