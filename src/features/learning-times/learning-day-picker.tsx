import { View } from "react-native";
import { Field, FieldLabel } from "~/components/ui/field";
import {
	SelectionControl,
	SelectionText,
} from "~/components/ui/selection-control";
import { Text } from "~/components/ui/text";
import {
	LEARNING_DAYS,
	type LearningDayLabel,
} from "~/features/learning-times/learning-time-days";

export function LearningDayPicker({
	selectedDay,
	onSelectedDayChange,
}: {
	selectedDay: LearningDayLabel;
	onSelectedDayChange: (day: LearningDayLabel) => void;
}) {
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
						<SelectionControl
							key={day.value}
							accessibilityLabel={day.label}
							accessibilityRole="radio"
							selected={isSelected}
							appearance="pill"
							className="aspect-square max-w-12 flex-1"
							contentClassName="min-h-0 flex-1 border-0"
							hitSlop={4}
							onPress={() => onSelectedDayChange(day.label)}
						>
							<SelectionText className="font-poppins font-semibold text-body-4">
								{day.abbreviation}
							</SelectionText>
						</SelectionControl>
					);
				})}
			</View>
		</Field>
	);
}
