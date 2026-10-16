import { Host } from "@expo/ui";
import { DateTimePicker } from "@expo/ui/jetpack-compose";
import { useDayovaTheme } from "~/lib/theme";
import {
	fromMaterialDatePickerDate,
	toMaterialDatePickerIso,
} from "./android-material-date";
import type { InlineDatePickerProps } from "./inline-date-picker.types";

export function InlineDatePicker({
	value,
	minimumDate,
	maximumDate,
	onChange,
}: InlineDatePickerProps) {
	const { colors, resolvedTheme } = useDayovaTheme();
	return (
		<Host
			colorScheme={resolvedTheme}
			seedColor={colors.primary}
			matchContents={{ vertical: true }}
			// Compose measures its height inside the available form-column width.
			style={{ width: "100%" }}
		>
			<DateTimePicker
				initialDate={toMaterialDatePickerIso(value)}
				displayedComponents="date"
				variant="picker"
				showVariantToggle={false}
				// Expo converts local bounds to UTC calendar days in native code.
				selectableDates={{ start: minimumDate, end: maximumDate }}
				elementColors={{
					containerColor: colors.background,
					selectedDayContainerColor: colors.primary,
					selectedDayContentColor: colors.onPrimary,
					selectedYearContainerColor: colors.primary,
					selectedYearContentColor: colors.onPrimary,
					todayContentColor: colors.primary,
					todayDateBorderColor: colors.primary,
				}}
				onDateSelected={(date) =>
					onChange(fromMaterialDatePickerDate(date, value))
				}
			/>
		</Host>
	);
}
