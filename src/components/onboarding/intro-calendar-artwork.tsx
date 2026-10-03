import { View } from "react-native";
import { CalendarDays } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { WeeklyLearningTimes } from "~/features/learning-times/weekly-learning-times";
import { useDayovaTheme } from "~/lib/theme";

const entries = [
	{ id: "intro-monday", dayOfWeek: 1, startTime: "16:00", endTime: "16:30" },
	{ id: "intro-thursday", dayOfWeek: 4, startTime: "17:00", endTime: "17:30" },
];

export function IntroCalendarArtwork({
	width,
	height,
}: {
	width: number;
	height: number;
}) {
	const { colors } = useDayovaTheme();
	const scale = Math.min(width / 330, height / 340);
	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			pointerEvents="none"
			className="items-center justify-center"
			// Runtime frame bounds keep this decorative preview within the page.
			style={{ width, height }}
			testID="intro-calendar-artwork"
		>
			<View
				className="w-[330px] gap-4"
				// Scale the fixed product excerpt to the runtime artboard.
				style={{ transform: [{ scale }] }}
			>
				<View className="flex-row items-center gap-3 px-4">
					<CalendarDays size={24} color={colors.primaryStrong} />
					<Text
						allowFontScaling={false}
						className="font-poppins font-semibold text-body-1 text-text"
					>
						Deine Woche
					</Text>
				</View>
				<WeeklyLearningTimes mode="artwork" entries={entries} />
			</View>
		</View>
	);
}
