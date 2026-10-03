import { Pressable, View } from "react-native";
import { ArrowRight, Clock3, Plus } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import { useDayovaTheme } from "~/lib/theme";

type WeeklyLearningTime = {
	id: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

type WeeklyLearningTimesProps = {
	entries: readonly WeeklyLearningTime[];
} & (
	| {
			mode?: "screen";
			onAdd: (dayOfWeek: number) => void;
			onEdit: (entry: WeeklyLearningTime) => void;
	  }
	| { mode: "artwork"; onAdd?: never; onEdit?: never }
);

function WeeklyLearningTimes({
	entries,
	onAdd,
	onEdit,
	mode = "screen",
}: WeeklyLearningTimesProps) {
	const { colors } = useDayovaTheme();
	const isArtwork = mode === "artwork";
	const Control = isArtwork ? View : Pressable;
	const days = isArtwork
		? LEARNING_DAYS.filter((day) =>
				entries.some((entry) => entry.dayOfWeek === day.value),
			)
		: LEARNING_DAYS;

	return (
		<View
			className="gap-3"
			accessibilityElementsHidden={isArtwork}
			importantForAccessibility={isArtwork ? "no-hide-descendants" : "auto"}
			pointerEvents={isArtwork ? "none" : "auto"}
		>
			{days.map((day) => {
				const dayEntries = entries
					.filter((entry) => entry.dayOfWeek === day.value)
					.sort((first, second) =>
						first.startTime.localeCompare(second.startTime),
					);
				const isEmpty = dayEntries.length === 0;

				return (
					<Surface
						key={day.value}
						className="overflow-hidden rounded-[28px] px-4 py-4"
						style={{ borderCurve: "continuous" }}
					>
						<View className="min-h-11 flex-row items-center">
							<View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
								<Text
									allowFontScaling={!isArtwork}
									className="font-poppins font-semibold text-body-4 text-text"
								>
									{day.abbreviation}
								</Text>
							</View>

							<View className="ml-3 flex-1">
								<Text
									allowFontScaling={!isArtwork}
									className="font-poppins font-semibold text-body-2 text-text"
								>
									{day.label}
								</Text>
								{isEmpty ? (
									<Text
										allowFontScaling={!isArtwork}
										className="mt-0.5 font-poppins text-body-4 text-secondary-text"
									>
										Noch keine Lernzeit
									</Text>
								) : null}
							</View>

							<Control
								accessibilityLabel={`Weitere Lernzeit für ${day.label} hinzufügen`}
								accessibilityRole={isArtwork ? undefined : "button"}
								hitSlop={6}
								className="h-11 w-11 items-center justify-center rounded-full bg-primary/10 active:bg-primary/20"
								onPress={isArtwork ? undefined : () => onAdd?.(day.value)}
							>
								<Plus size={20} color={colors.primary} strokeWidth={2.2} />
							</Control>
						</View>

						{isEmpty ? null : (
							<View className="mt-3 gap-2">
								{dayEntries.map((entry) => {
									const timeRange = `${entry.startTime}–${entry.endTime}`;

									return (
										<Control
											key={entry.id}
											accessibilityLabel={`${day.label}, Lernzeit ${entry.startTime} bis ${entry.endTime} bearbeiten`}
											accessibilityRole={isArtwork ? undefined : "button"}
											className="min-h-12 flex-row items-center rounded-[18px] bg-muted px-4 active:opacity-80"
											onPress={isArtwork ? undefined : () => onEdit?.(entry)}
											style={{ borderCurve: "continuous" }}
										>
											<Clock3
												size={18}
												color={colors.secondaryText}
												strokeWidth={2}
											/>
											<Text
												allowFontScaling={!isArtwork}
												selectable={!isArtwork}
												className="ml-3 flex-1 font-poppins font-semibold text-body-3 text-text"
												style={{ fontVariant: ["tabular-nums"] }}
											>
												{timeRange}
											</Text>
											<ArrowRight
												size={18}
												color={colors.secondaryText}
												strokeWidth={2}
											/>
										</Control>
									);
								})}
							</View>
						)}
					</Surface>
				);
			})}
		</View>
	);
}

export type { WeeklyLearningTime };
export { WeeklyLearningTimes };
