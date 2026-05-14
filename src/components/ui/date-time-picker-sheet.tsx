import DateTimePicker, {
	type DateTimePickerEvent,
} from "@expo/ui/community/datetime-picker";
import { type ReactNode, useEffect, useRef } from "react";
import { Platform, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	BottomSheetModal,
	BottomSheetView,
} from "@expo/ui/community/bottom-sheet";
import { Text } from "~/components/ui/text";

type DateTimePickerSheetProps = {
	visible: boolean;
	value: Date;
	mode: "date" | "time" | "datetime";
	display?: "default" | "spinner" | "compact" | "inline" | "calendar" | "clock";
	maximumDate?: Date;
	minimumDate?: Date;
	doneLabel?: ReactNode;
	onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
	onClose: () => void;
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
	const sheetRef = useRef<BottomSheetModal>(null);
	const insets = useSafeAreaInsets();

	useEffect(() => {
		if (Platform.OS !== "ios") return;

		if (visible) {
			sheetRef.current?.present();
			return;
		}

		sheetRef.current?.dismiss();
	}, [visible]);

	if (!visible) return null;

	if (Platform.OS === "android") {
		return (
			<DateTimePicker
				value={value}
				mode={mode}
				display={display ?? "default"}
				maximumDate={maximumDate}
				minimumDate={minimumDate}
				presentation="dialog"
				onChange={onChange}
				onDismiss={onClose}
			/>
		);
	}

	return (
		<BottomSheetModal
			ref={sheetRef}
			enablePanDownToClose
			enableDynamicSizing
			onClose={onClose}
			backgroundStyle={{ backgroundColor: "#FFFFFF" }}
		>
			<BottomSheetView>
				<View
					className="bg-white px-4 pt-3 pb-7"
					style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}
				>
					<View className="mb-1 flex-row justify-end">
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
							display={display ?? "spinner"}
							maximumDate={maximumDate}
							minimumDate={minimumDate}
							onChange={onChange}
						/>
					</View>
				</View>
			</BottomSheetView>
		</BottomSheetModal>
	);
}

export { DateTimePickerSheet };
export type { DateTimePickerEvent };
