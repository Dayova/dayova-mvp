import { Pressable, useWindowDimensions, View } from "react-native";
import { ArrowRight, Clock3, Plus } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

type WeeklyLearningTime = {
	id: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

type WeeklyLearningTimesProps = {
	entries: readonly WeeklyLearningTime[];
	onAdd: (dayOfWeek: number) => void;
	onEdit: (entry: WeeklyLearningTime) => void;
};

function WeeklyLearningTimes({
	entries,
	onAdd,
	onEdit,
}: WeeklyLearningTimesProps) {
	const { colors } = useDayovaTheme();
	const { fontScale } = useWindowDimensions();

	return (
		<Surface
			className="overflow-hidden border border-border px-4"
			style={{ borderCurve: "continuous" }}
		>
			{LEARNING_DAYS.map((day, index) => {
				const dayEntries = entries
					.filter((entry) => entry.dayOfWeek === day.value)
					.sort((first, second) =>
						first.startTime.localeCompare(second.startTime),
					);
				const isEmpty = dayEntries.length === 0;

				return (
					<View
						key={day.value}
						className={cn(
							"py-3",
							index < LEARNING_DAYS.length - 1 && "border-border border-b",
						)}
					>
						<View className="min-h-11 flex-row items-center">
							<View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
								<Text
									allowFontScaling={false}
									className="font-poppins font-semibold text-body-4 text-text"
								>
									{day.abbreviation}
								</Text>
							</View>

							<View className="ml-3 min-w-0 flex-1">
								<Text
									className="font-poppins font-semibold text-body-2 text-text"
									style={{ lineHeight: 24 * fontScale }}
								>
									{day.label}
								</Text>
								{isEmpty ? (
									<Text
										className="mt-0.5 font-poppins text-body-4 text-secondary-text"
										style={{ lineHeight: 18 * fontScale }}
									>
										Keine Lernzeit
									</Text>
								) : null}
							</View>

							<Pressable
								accessibilityLabel={`Weitere Lernzeit für ${day.label} hinzufügen`}
								accessibilityRole="button"
								hitSlop={6}
								className="h-11 w-11 items-center justify-center rounded-full bg-primary/10 active:bg-primary/20"
								onPress={() => onAdd(day.value)}
							>
								<Plus size={20} color={colors.primary} strokeWidth={2.2} />
							</Pressable>
						</View>

						{isEmpty ? null : (
							<View className="mt-2 gap-2 pl-13">
								{dayEntries.map((entry) => {
									const timeRange = `${entry.startTime}–${entry.endTime}`;

									return (
										<Pressable
											key={entry.id}
											accessibilityLabel={`${day.label}, Lernzeit ${entry.startTime} bis ${entry.endTime} bearbeiten`}
											accessibilityRole="button"
											className="min-h-11 flex-row items-center rounded-[18px] bg-muted px-4 py-2 active:opacity-80"
											onPress={() => onEdit(entry)}
											style={{ borderCurve: "continuous" }}
										>
											<Clock3
												size={18}
												color={colors.secondaryText}
												strokeWidth={2}
											/>
											<Text
												selectable
												className="ml-3 flex-1 font-poppins font-semibold text-body-3 text-text"
												style={{
													fontVariant: ["tabular-nums"],
													lineHeight: 21 * fontScale,
												}}
											>
												{timeRange}
											</Text>
											<ArrowRight
												size={18}
												color={colors.secondaryText}
												strokeWidth={2}
											/>
										</Pressable>
									);
								})}
							</View>
						)}
					</View>
				);
			})}
		</Surface>
	);
}

export type { WeeklyLearningTime };
export { WeeklyLearningTimes };
