import DateTimePicker, {
	DateTimePickerAndroid,
	type DateTimePickerEvent,
} from "@expo/ui/community/datetime-picker";
import { type ReactNode } from "react";
import {
	Modal,
	Platform,
	Pressable,
	TouchableOpacity,
	useWindowDimensions,
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
	const { width } = useWindowDimensions();

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
			onRequestClose={onClose}
		>
			<View className="flex-1 justify-end">
				<Pressable className="absolute inset-0 bg-black/25" onPress={onClose} />
				<View
					className="bg-white px-4 pt-3"
					style={{
						width,
						borderTopLeftRadius: 30,
						borderTopRightRadius: 30,
						paddingBottom: Math.max(insets.bottom + 14, 24),
					}}
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
					<View className="items-center overflow-hidden">
						<DateTimePicker
							value={value}
							mode={mode}
							display={normalizeIosDisplay(display)}
							maximumDate={maximumDate}
							minimumDate={minimumDate}
							locale="de-DE"
							onChange={onChange}
							style={{
								width: width - 32,
								height: mode === "datetime" ? 260 : 216,
							}}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}

export { DateTimePickerSheet };
export type { DateTimePickerEvent };
