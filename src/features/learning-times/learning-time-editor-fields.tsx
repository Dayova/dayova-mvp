import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";
import { Field, FieldLabel } from "~/components/ui/field";
import { Timer } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { useDayovaTheme } from "~/lib/theme";

type TimeControlProps = {
	label: string;
	value: string;
	onPress: () => void;
};

function TimeControl({ label, value, onPress }: TimeControlProps) {
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-1 gap-2">
			<Text className="font-poppins text-body-4 text-secondary-text">
				{label}
			</Text>
			<Pressable
				accessibilityLabel={`${label}: ${value}`}
				accessibilityRole="button"
				className="min-h-14 flex-row items-center justify-between rounded-[24px] border border-border bg-card px-5 active:opacity-80"
				onPress={onPress}
				style={{ borderCurve: "continuous" }}
			>
				<Text
					selectable
					className="font-poppins font-semibold text-body-2 text-text"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{value}
				</Text>
				<Timer size={19} color={colors.secondaryText} strokeWidth={1.9} />
			</Pressable>
		</View>
	);
}

type LearningTimeEditorFieldsProps = {
	selectedDay: LearningDayLabel;
	outlinedDays?: boolean;
	endLabel?: string;
	startTime: string;
	endTime: string;
	onDayChange: (day: LearningDayLabel) => void;
	onStartTimePress: () => void;
	onEndTimePress: () => void;
};

function LearningTimeEditorFields({
	selectedDay,
	outlinedDays = false,
	endLabel = "Ende",
	startTime,
	endTime,
	onDayChange,
	onStartTimePress,
	onEndTimePress,
}: LearningTimeEditorFieldsProps) {
	const { colors } = useDayovaTheme();
	const selectedDayValue =
		LEARNING_DAYS.find((day) => day.label === selectedDay)?.value ?? 1;

	return (
		<>
			<Field className="mb-0">
				<View className="mb-2 flex-row items-center justify-between">
					<FieldLabel className="mb-0">Wochentag</FieldLabel>
					<Text
						selectable
						className="font-poppins font-semibold text-body-4 text-secondary-text"
					>
						{selectedDay}
					</Text>
				</View>
				<View className="flex-row justify-between gap-1">
					{LEARNING_DAYS.map((day) => {
						const isSelected = day.value === selectedDayValue;

						return (
							<Pressable
								key={day.value}
								accessibilityLabel={day.label}
								accessibilityRole="radio"
								accessibilityState={{ checked: isSelected }}
								className="aspect-square max-w-12 flex-1 items-center justify-center overflow-hidden rounded-full active:opacity-80"
								onPress={() => onDayChange(day.label)}
								style={{
									backgroundColor: isSelected ? colors.primary : colors.surface,
									borderCurve: "continuous",
									borderWidth: outlinedDays && !isSelected ? 1 : 0,
									borderColor: colors.border,
								}}
							>
								{outlinedDays && isSelected ? (
									<LinearGradient
										pointerEvents="none"
										{...DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive}
										style={StyleSheet.absoluteFill}
									/>
								) : null}
								<Text
									className="font-poppins font-semibold text-body-4"
									style={{
										color: isSelected
											? outlinedDays
												? "#FFFFFF"
												: colors.onPrimary
											: colors.text,
									}}
								>
									{day.abbreviation}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</Field>

			<View className="flex-row gap-3">
				<TimeControl
					label="Beginn"
					value={startTime}
					onPress={onStartTimePress}
				/>
				<TimeControl
					label={endLabel}
					value={endTime}
					onPress={onEndTimePress}
				/>
			</View>
		</>
	);
}

export type { LearningTimeEditorFieldsProps };
export { LearningTimeEditorFields };
