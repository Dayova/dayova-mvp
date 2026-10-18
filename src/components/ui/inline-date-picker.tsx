import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useDayovaTheme } from "~/lib/theme";
import type { InlineDatePickerProps } from "./inline-date-picker.types";

/** A persistent calendar; selecting a day immediately updates the form. */
export function InlineDatePicker({
	value,
	minimumDate,
	maximumDate,
	onChange,
}: InlineDatePickerProps) {
	const { colors, resolvedTheme } = useDayovaTheme();
	const [width, setWidth] = useState(0);
	const { fontScale } = useWindowDimensions();
	return (
		<View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
			{width > 0 ? (
				<DateTimePicker
					value={value}
					mode="date"
					display="inline"
					minimumDate={minimumDate}
					maximumDate={maximumDate}
					locale="de-DE"
					themeVariant={resolvedTheme}
					accentColor={colors.primary}
					onValueChange={(_event, date) => onChange(date)}
					// Expo’s native host needs explicit dimensions to stay in the form
					// layout on redraw; allow more vertical space at larger text sizes.
					style={{ width, height: 340 * Math.max(1, fontScale) }}
				/>
			) : null}
		</View>
	);
}
