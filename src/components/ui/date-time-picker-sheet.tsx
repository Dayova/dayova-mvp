import DateTimePicker, {
	type DateTimePickerChangeEvent,
} from "@expo/ui/community/datetime-picker";
import type { ReactNode } from "react";
import {
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";

type DateTimePickerDisplay =
	| "default"
	| "spinner"
	| "compact"
	| "inline"
	| "calendar"
	| "clock";

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
	const contentSizeLayout = useContentSizeLayout();
	const sheetWidth = Math.min(width, contentSizeLayout.containerMaxWidth);
	const handleValueChange = (event: DateTimePickerChangeEvent, date: Date) => {
		onChange({ ...event, type: "set" }, date);
	};

	const handleDismiss = () => {
		onChange({ type: "dismissed" });
	};

	if (!visible) return null;

	if (Platform.OS === "android") {
		return (
			<DateTimePicker
				value={value}
				mode={mode}
				display={normalizeAndroidDisplay(display)}
				maximumDate={maximumDate}
				minimumDate={minimumDate}
				onValueChange={handleValueChange}
				onDismiss={handleDismiss}
			/>
		);
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			presentationStyle="overFullScreen"
			statusBarTranslucent
			onRequestClose={onClose}
		>
			<View style={styles.modalRoot}>
				<Pressable style={styles.backdrop} onPress={onClose} />
				<View
					className="rounded-t-card bg-card px-4 pt-3"
					// Position, width, and bottom padding depend on viewport/safe-area data.
					style={{
						position: "absolute",
						left: (width - sheetWidth) / 2,
						bottom: 0,
						paddingBottom: Math.max(insets.bottom + 14, 24),
						width: sheetWidth,
					}}
				>
					<View className="h-1 w-14 self-center rounded-full bg-black/12" />
					<View className="mb-1 flex-row justify-end pt-4">
						<TouchableOpacity
							accessibilityLabel="Auswahl schließen"
							accessibilityRole="button"
							hitSlop={8}
							onPress={onClose}
							className="px-3 py-2"
						>
							<Text className="font-poppins font-semibold text-body-2 text-primary">
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
							onValueChange={handleValueChange}
							// Expo's native picker needs explicit measured dimensions.
							style={{
								width: sheetWidth - 32,
								height: mode === "datetime" ? 260 : 216,
							}}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalRoot: {
		flex: 1,
		justifyContent: "flex-end",
	},
	backdrop: {
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		backgroundColor: "rgba(0, 0, 0, 0.25)",
	},
});

export { DateTimePickerSheet };
export type { DateTimePickerSheetEvent as DateTimePickerEvent };
