import type { ReactNode } from "react";

type DateTimePickerDisplay =
	| "default"
	| "spinner"
	| "compact"
	| "inline"
	| "calendar"
	| "clock";

type DateTimePickerChangeEvent = {
	nativeEvent: {
		timestamp: number;
		utcOffset: number;
	};
};

type DateTimePickerSheetEvent =
	| (DateTimePickerChangeEvent & { type: "set" })
	| { type: "dismissed" };

type DateTimePickerSheetProps = {
	visible: boolean;
	value: Date;
	mode: "date" | "time" | "datetime";
	display?: DateTimePickerDisplay;
	maximumDate?: Date;
	minimumDate?: Date;
	doneLabel?: ReactNode;
	onChange: (event: DateTimePickerSheetEvent, selectedDate?: Date) => void;
	onClose: () => void;
};

function buildDateTimePickerChangeEvent(
	date: Date,
): DateTimePickerChangeEvent & { type: "set" } {
	return {
		type: "set",
		nativeEvent: {
			timestamp: date.getTime(),
			utcOffset: -date.getTimezoneOffset(),
		},
	};
}

const shouldCloseDateTimePickerAfterChange = (platform: string) =>
	platform === "android";

export { buildDateTimePickerChangeEvent, shouldCloseDateTimePickerAfterChange };
export type {
	DateTimePickerChangeEvent,
	DateTimePickerDisplay,
	DateTimePickerSheetEvent,
	DateTimePickerSheetProps,
};
