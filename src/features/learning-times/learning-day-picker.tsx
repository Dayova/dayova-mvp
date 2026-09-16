import { Pressable, View } from "react-native";
import { Field, FieldLabel } from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function LearningDayPicker({
	selectedDay,
	onSelectedDayChange,
}: {
	selectedDay: LearningDayLabel;
	onSelectedDayChange: (day: LearningDayLabel) => void;
}) {
	const { colors } = useDayovaTheme();

	return (
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
			<View className="flex-row gap-1.5">
				{LEARNING_DAYS.map((day) => {
					const isSelected = day.label === selectedDay;

					return (
						<Pressable
							key={day.value}
							accessibilityLabel={day.label}
							accessibilityRole="radio"
							accessibilityState={{ checked: isSelected }}
							className="h-12 flex-1 items-center justify-center rounded-full active:opacity-80"
							onPress={() => onSelectedDayChange(day.label)}
							style={{
								backgroundColor: isSelected ? colors.primary : colors.surface,
								borderCurve: "continuous",
							}}
						>
							<Text
								className={cn(
									"font-poppins font-semibold text-body-4",
									isSelected ? "text-white" : "text-text",
								)}
							>
								{day.abbreviation}
							</Text>
						</Pressable>
					);
				})}
			</View>
		</Field>
	);
}
