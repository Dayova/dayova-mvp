import { Pressable, ScrollView, View } from "react-native";
import { Field, FieldLabel } from "~/components/ui/field";
import { Timer } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import {
	SelectionControl,
	SelectionText,
} from "~/components/ui/selection-control";
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
	disabled?: boolean;
};

function TimeControl({ label, value, onPress, disabled }: TimeControlProps) {
	const { colors } = useDayovaTheme();

	return (
		<View className="flex-1 gap-2">
			<Text className="font-poppins text-body-4 text-secondary-text">
				{label}
			</Text>
			<Pressable
				accessibilityLabel={`${label}: ${value}`}
				accessibilityRole="button"
				disabled={disabled}
				accessibilityState={{ disabled }}
				className="min-h-14 flex-row items-center justify-between rounded-[24px] border border-border bg-card px-5 active:opacity-80"
				onPress={onPress}
			>
				<Text
					selectable
					className="font-poppins font-semibold text-body-2 text-text"
					// Tabular clock digits are a native text geometry property.
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
	startTime: string;
	endTime: string;
	onDayChange: (day: LearningDayLabel) => void;
	onStartTimePress: () => void;
	onEndTimePress: () => void;
	disabled?: boolean;
};

function LearningTimeEditorFields({
	selectedDay,
	startTime,
	endTime,
	onDayChange,
	onStartTimePress,
	onEndTimePress,
	disabled = false,
}: LearningTimeEditorFieldsProps) {
	const { shouldStackInlineContent } = useContentSizeLayout();
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
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerClassName="grow"
				>
					<View
						testID="learning-weekday-row"
						className="grow flex-row justify-between gap-1"
					>
						{LEARNING_DAYS.map((day) => {
							const isSelected = day.value === selectedDayValue;

							return (
								<SelectionControl
									key={day.value}
									appearance="pill"
									selected={isSelected}
									disabled={disabled}
									accessibilityLabel={day.label}
									contentClassName="min-h-11 min-w-11 px-2 py-3"
									onPress={() => onDayChange(day.label)}
								>
									<SelectionText className="font-poppins font-semibold text-body-4">
										{day.abbreviation}
									</SelectionText>
								</SelectionControl>
							);
						})}
					</View>
				</ScrollView>
			</Field>

			<View className={cn("gap-3", !shouldStackInlineContent && "flex-row")}>
				<TimeControl
					label="Beginn"
					disabled={disabled}
					value={startTime}
					onPress={onStartTimePress}
				/>
				<TimeControl
					disabled={disabled}
					label="Ende"
					value={endTime}
					onPress={onEndTimePress}
				/>
			</View>
		</>
	);
}

export type { LearningTimeEditorFieldsProps };
export { LearningTimeEditorFields };
