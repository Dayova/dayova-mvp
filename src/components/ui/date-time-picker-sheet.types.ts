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
	/** Render within an existing sheet on iOS; Android retains its native dialog. */
	embedded?: boolean;
	visible: boolean;
	value: Date;
	mode: "date" | "time" | "datetime";
	display?: DateTimePickerDisplay;
	maximumDate?: Date;
	minimumDate?: Date;
	doneLabel?: ReactNode;
	onChange: (event: DateTimePickerSheetEvent, selectedDate?: Date) => void;
	onClose: () => void;
	onConfirm?: (selectedDate: Date) => void;
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

const getDateTimePickerConfirmAccessibilityLabel = (doneLabel: ReactNode) =>
	typeof doneLabel === "string" ? doneLabel : "Auswahl bestätigen";

export type {
	DateTimePickerChangeEvent,
	DateTimePickerDisplay,
	DateTimePickerSheetEvent,
	DateTimePickerSheetProps,
};
export {
	buildDateTimePickerChangeEvent,
	getDateTimePickerConfirmAccessibilityLabel,
	shouldCloseDateTimePickerAfterChange,
};
