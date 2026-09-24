import { Pressable, View } from "react-native";
import { Timer } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { LearningDayPicker } from "~/features/learning-times/learning-day-picker";
import type { LearningDayLabel } from "~/features/learning-times/learning-time-days";
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
	return (
		<>
			<LearningDayPicker
				selectedDay={selectedDay}
				onSelectedDayChange={onDayChange}
			/>

			<View className="flex-row gap-3">
				<TimeControl
					label="Beginn"
					value={startTime}
					onPress={onStartTimePress}
				/>
				<TimeControl label="Ende" value={endTime} onPress={onEndTimePress} />
			</View>
		</>
	);
}

export { LearningTimeEditorFields };
export type { LearningTimeEditorFieldsProps };
