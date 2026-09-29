import { Pressable, useWindowDimensions, View } from "react-native";
import { Field, FieldLabel } from "~/components/ui/field";
import { Timer } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type TimeControlProps = {
	label: string;
	value: string;
	onPress: () => void;
	stacked: boolean;
};

function TimeControl({ label, value, onPress, stacked }: TimeControlProps) {
	const { colors } = useDayovaTheme();
	const { fontScale } = useWindowDimensions();

	return (
		<View className={cn("gap-2", !stacked && "flex-1")}>
			<Text
				className="font-poppins text-body-4 text-secondary-text"
				style={{ lineHeight: 18 * fontScale }}
			>
				{label}
			</Text>
			<Pressable
				accessibilityLabel={`${label}: ${value}`}
				accessibilityRole="button"
				className="min-h-14 flex-row items-center justify-between rounded-[24px] border border-border bg-card px-5 py-3 active:opacity-80"
				onPress={onPress}
				style={{ borderCurve: "continuous" }}
			>
				<Text
					selectable
					className="font-poppins font-semibold text-body-2 text-text"
					style={{ fontVariant: ["tabular-nums"], lineHeight: 24 * fontScale }}
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
	startTime: string;
	endTime: string;
	onDayChange: (day: LearningDayLabel) => void;
	onStartTimePress: () => void;
	onEndTimePress: () => void;
};

function LearningTimeEditorFields({
	selectedDay,
	startTime,
	endTime,
	onDayChange,
	onStartTimePress,
	onEndTimePress,
}: LearningTimeEditorFieldsProps) {
	const { colors } = useDayovaTheme();
	const { fontScale } = useWindowDimensions();
	const useWrappedControls = fontScale >= 1.5;
	const useSingleColumnControls = fontScale >= 2;
	const selectedDayValue =
		LEARNING_DAYS.find((day) => day.label === selectedDay)?.value ?? 1;

	return (
		<>
			<Field className="mb-0">
				<View className="mb-2 flex-row items-center justify-between">
					<FieldLabel className="mb-0" style={{ lineHeight: 18 * fontScale }}>
						Wochentag
					</FieldLabel>
					{useWrappedControls ? null : (
						<Text
							selectable
							className="font-poppins font-semibold text-body-4 text-secondary-text"
						>
							{selectedDay}
						</Text>
					)}
				</View>
				<View
					className={cn(
						"flex-row",
						useWrappedControls ? "flex-wrap gap-2" : "justify-between gap-1",
					)}
				>
					{LEARNING_DAYS.map((day) => {
						const isSelected = day.value === selectedDayValue;

						return (
							<Pressable
								key={day.value}
								accessibilityLabel={day.label}
								accessibilityRole="radio"
								accessibilityState={{ checked: isSelected }}
								className={cn(
									"items-center justify-center active:opacity-80",
									useSingleColumnControls
										? "min-h-14 w-full rounded-[24px] px-4 py-3"
										: useWrappedControls
											? "min-h-14 min-w-[45%] flex-1 rounded-[24px] px-3 py-2"
											: "aspect-square max-w-12 flex-1 rounded-full",
								)}
								onPress={() => onDayChange(day.label)}
								style={{
									backgroundColor: isSelected ? colors.primary : colors.surface,
									borderCurve: "continuous",
								}}
							>
								<Text
									className="font-poppins font-semibold text-body-4"
									style={{
										color: isSelected ? colors.onPrimary : colors.text,
										lineHeight: 18 * fontScale,
									}}
								>
									{useWrappedControls ? day.label : day.abbreviation}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</Field>

			<View className={cn("gap-3", !useWrappedControls && "flex-row")}>
				<TimeControl
					label="Beginn"
					value={startTime}
					onPress={onStartTimePress}
					stacked={useWrappedControls}
				/>
				<TimeControl
					label="Ende"
					value={endTime}
					onPress={onEndTimePress}
					stacked={useWrappedControls}
				/>
			</View>
		</>
	);
}

export type { LearningTimeEditorFieldsProps };
export { LearningTimeEditorFields };
