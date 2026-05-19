import DateTimePicker, {
	DateTimePickerAndroid,
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { type ReactNode, useEffect } from "react";
import {
	Modal,
	Platform,
	Pressable,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "~/components/ui/text";

type DateTimePickerDisplay =
	| "default"
	| "spinner"
	| "compact"
	| "inline"
	| "calendar"
	| "clock";

type DateTimePickerSheetProps = {
	visible: boolean;
	value: Date;
	mode: "date" | "time" | "datetime";
	display?: DateTimePickerDisplay;
	maximumDate?: Date;
	minimumDate?: Date;
	doneLabel?: ReactNode;
	onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
	onClose: () => void;
};

const normalizeAndroidDisplay = (display?: DateTimePickerDisplay) => {
	if (display === "calendar" || display === "clock" || display === "spinner") {
		return display;
	}

	return "default";
};

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
	const insets = useSafeAreaInsets();

	useEffect(() => {
		if (!visible || Platform.OS !== "android") {
			return;
		}

		return () => {
			DateTimePickerAndroid.dismiss(mode === "datetime" ? "date" : mode);
		};
	}, [mode, visible]);

	if (!visible) return null;

	if (Platform.OS === "android") {
		return (
			<DateTimePicker
				value={value}
				mode={mode}
				display={normalizeAndroidDisplay(display)}
				maximumDate={maximumDate}
				minimumDate={minimumDate}
				onChange={onChange}
			/>
		);
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			presentationStyle="overFullScreen"
			onRequestClose={onClose}
		>
			<View className="flex-1 justify-end bg-black/20">
				<Pressable className="flex-1" onPress={onClose} />
				<View
					className="overflow-hidden rounded-t-[34px] bg-white px-4 pt-3"
					style={{ paddingBottom: Math.max(insets.bottom + 14, 24) }}
				>
					<View className="self-center rounded-full bg-black/12 h-1.5 w-14" />
					<View className="mb-1 flex-row justify-end pt-4">
						<TouchableOpacity
							accessibilityLabel="Auswahl schließen"
							accessibilityRole="button"
							hitSlop={8}
							onPress={onClose}
							className="px-3 py-2"
						>
							<Text className="font-bold font-poppins text-16 text-primary">
								{doneLabel}
							</Text>
						</TouchableOpacity>
					</View>
					<View className="items-center">
						<DateTimePicker
							value={value}
							mode={mode}
							display={normalizeIosDisplay(display)}
							maximumDate={maximumDate}
							minimumDate={minimumDate}
							locale="de-DE"
							onChange={onChange}
							style={{ height: 216, width: "100%" }}
							themeVariant="light"
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}

export { DateTimePickerSheet };
export type { DateTimePickerEvent };
