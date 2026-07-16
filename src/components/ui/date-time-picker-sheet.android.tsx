import {
	DatePickerDialog,
	Host,
	TimePickerDialog,
} from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";
import {
	fromMaterialDatePickerDate,
	toMaterialDatePickerIso,
} from "./android-material-date";
import {
	buildDateTimePickerChangeEvent,
	type DateTimePickerDisplay,
	type DateTimePickerSheetProps,
} from "./date-time-picker-sheet.types";

const DAYOVA_PRIMARY = DAYOVA_DESIGN_SYSTEM.colors.primary;

function normalizeAndroidVariant(display?: DateTimePickerDisplay) {
	return display === "spinner" ? "input" : "picker";
}

function VisibleDateTimePickerSheet({
	value,
	mode,
	display,
	maximumDate,
	minimumDate,
	doneLabel = "Fertig",
	onChange,
}: DateTimePickerSheetProps) {
	const { resolvedTheme } = useDayovaTheme();
	const [datetimeDate, setDatetimeDate] = useState<Date | null>(null);

	const handleValueChange = (date: Date) => {
		onChange(buildDateTimePickerChangeEvent(date), date);
	};
	const handleDateSelected = (date: Date) => {
		const localDate = fromMaterialDatePickerDate(date, value);
		if (mode !== "datetime") {
			handleValueChange(localDate);
			return;
		}

		setDatetimeDate(localDate);
	};
	const handleTimeSelected = (date: Date) => {
		if (mode !== "datetime" || !datetimeDate) {
			handleValueChange(date);
			return;
		}

		const combinedDate = new Date(datetimeDate);
		combinedDate.setHours(
			date.getHours(),
			date.getMinutes(),
			date.getSeconds(),
			date.getMilliseconds(),
		);
		handleValueChange(combinedDate);
	};
	const handleDismiss = () => {
		onChange({ type: "dismissed" });
	};
	const confirmButtonLabel =
		typeof doneLabel === "string" ? doneLabel : "Fertig";
	const sharedDialogProps = {
		color: DAYOVA_PRIMARY,
		confirmButtonLabel,
		dismissButtonLabel: "Abbrechen",
		onDismissRequest: handleDismiss,
	};
	const isTimePicker = mode === "time" || datetimeDate !== null;

	return (
		<Host colorScheme={resolvedTheme} seedColor={DAYOVA_PRIMARY}>
			{isTimePicker ? (
				<TimePickerDialog
					{...sharedDialogProps}
					initialDate={(datetimeDate ?? value).toISOString()}
					onDateSelected={handleTimeSelected}
				/>
			) : (
				<DatePickerDialog
					{...sharedDialogProps}
					initialDate={toMaterialDatePickerIso(value)}
					onDateSelected={handleDateSelected}
					selectableDates={
						minimumDate || maximumDate
							? { start: minimumDate, end: maximumDate }
							: undefined
					}
					variant={normalizeAndroidVariant(display)}
				/>
			)}
		</Host>
	);
}

function DateTimePickerSheet(props: DateTimePickerSheetProps) {
	if (!props.visible) return null;
	return <VisibleDateTimePickerSheet key={props.mode} {...props} />;
}

export { DateTimePickerSheet };
export type { DateTimePickerSheetEvent as DateTimePickerEvent } from "./date-time-picker-sheet.types";
