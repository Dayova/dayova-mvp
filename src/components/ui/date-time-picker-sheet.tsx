import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useWindowDimensions, View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import type {
	DateTimePickerChangeEvent,
	DateTimePickerDisplay,
	DateTimePickerSheetProps,
} from "./date-time-picker-sheet.types";

const DAYOVA_PRIMARY = DAYOVA_DESIGN_SYSTEM.colors.primary;

const normalizeIosDisplay = (display?: DateTimePickerDisplay) => {
	if (display === "compact" || display === "inline" || display === "default") {
		return display;
	}

	return "spinner";
};

function DateTimePickerSheet({
	visible,
	value,
	mode,
	display,
	maximumDate,
	minimumDate,
	doneLabel = "Fertig",
	onChange,
	onClose,
}: DateTimePickerSheetProps) {
	const { width } = useWindowDimensions();
	const accessibilityLabel = {
		date: "Datum auswählen",
		time: "Uhrzeit auswählen",
		datetime: "Datum und Uhrzeit auswählen",
	}[mode];
	const handleValueChange = (event: DateTimePickerChangeEvent, date: Date) => {
		onChange({ ...event, type: "set" }, date);
	};

	return (
		<DayovaSheetFrame
			accessibilityLabel={accessibilityLabel}
			visible={visible}
			onClose={onClose}
			showCloseButton={false}
			closeAccessibilityLabel="Auswahl schließen"
			footer={
				<Button accessibilityLabel="Auswahl schließen" onPress={onClose}>
					<Text>{doneLabel}</Text>
				</Button>
			}
		>
			<View className="items-center overflow-hidden">
				<DateTimePicker
					accentColor={DAYOVA_PRIMARY}
					value={value}
					mode={mode}
					display={normalizeIosDisplay(display)}
					maximumDate={maximumDate}
					minimumDate={minimumDate}
					locale="de-DE"
					onValueChange={handleValueChange}
					// Expo's native picker needs explicit measured dimensions.
					style={{
						width: Math.min(width, 560) - 48,
						height: mode === "datetime" ? 260 : 216,
					}}
				/>
			</View>
		</DayovaSheetFrame>
	);
}

export { DateTimePickerSheet };
export type { DateTimePickerSheetEvent as DateTimePickerEvent } from "./date-time-picker-sheet.types";
