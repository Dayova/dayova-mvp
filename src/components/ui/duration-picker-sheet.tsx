import { Host, Picker } from "@expo/ui";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

/** A duration, not a clock time: independent hour/minute wheels without AM/PM. */
export function DurationPickerSheet({
	value,
	onConfirm,
	onDismiss,
}: {
	value: number;
	onConfirm: (minutes: number) => void;
	onDismiss: () => void;
}) {
	const { resolvedTheme, colors } = useDayovaTheme();
	const [minutes, setMinutes] = useState(value);
	const [visible, setVisible] = useState(true);
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	const valid = minutes >= 5 && minutes <= 240 && minutes % 5 === 0;
	return (
		<DayovaSheetFrame
			visible={visible}
			title="Lerndauer"
			description="Wie lange möchtest du lernen?"
			scrollable={false}
			onClose={() => setVisible(false)}
			onDismiss={onDismiss}
			footer={
				<Button
					disabled={!valid}
					onPress={() => {
						onConfirm(minutes);
						setVisible(false);
					}}
				>
					<Text>Übernehmen</Text>
				</Button>
			}
		>
			<View className="flex-row">
				<View className="flex-1">
					<Text className="text-center text-body-3 text-secondary-text">
						Stunden
					</Text>
					<Host
						colorScheme={resolvedTheme}
						seedColor={colors.primary}
						ignoreSafeArea="all"
						// Native wheels need explicit geometry inside the React Native sheet.
						style={{ height: 216, width: "100%" }}
					>
						<Picker
							appearance="wheel"
							selectedValue={hours}
							testID="duration-hours"
							onValueChange={(hour) =>
								setMinutes(Number(hour) * 60 + remainder)
							}
						>
							{[0, 1, 2, 3, 4].map((hour) => (
								<Picker.Item key={hour} value={hour} label={`${hour} Std.`} />
							))}
						</Picker>
					</Host>
				</View>
				<View className="flex-1">
					<Text className="text-center text-body-3 text-secondary-text">
						Minuten
					</Text>
					<Host
						colorScheme={resolvedTheme}
						seedColor={colors.primary}
						ignoreSafeArea="all"
						// Keep both native columns equally sized; no clock-time or timezone conversion.
						style={{ height: 216, width: "100%" }}
					>
						<Picker
							appearance="wheel"
							selectedValue={remainder}
							testID="duration-minutes"
							onValueChange={(minute) =>
								setMinutes(hours * 60 + Number(minute))
							}
						>
							{Array.from({ length: 12 }, (_, index) => index * 5).map(
								(minute) => (
									<Picker.Item
										key={minute}
										value={minute}
										label={`${minute} Min.`}
									/>
								),
							)}
						</Picker>
					</Host>
				</View>
			</View>
			<Text
				accessibilityRole={valid ? undefined : "alert"}
				className="text-center text-body-3 text-secondary-text"
			>
				{valid
					? `${minutes} Minuten Lernzeit`
					: "Wähle 5 Minuten bis 4 Stunden."}
			</Text>
		</DayovaSheetFrame>
	);
}
