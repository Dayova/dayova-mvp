import { Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Pencil, Trash2 } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import { useDayovaTheme } from "~/lib/theme";

type WeeklyLearningTime = {
	id: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	preferenceStatus?: "systemDefault" | "confirmed";
};

type WeeklyLearningTimesProps = {
	entries: readonly WeeklyLearningTime[];
	onAdd: (dayOfWeek: number) => void;
	onEdit: (entry: WeeklyLearningTime) => void;
	onRemove: (entry: WeeklyLearningTime) => void;
};

function WeeklyLearningTimes({
	entries,
	onAdd,
	onEdit,
	onRemove,
}: WeeklyLearningTimesProps) {
	const { colors } = useDayovaTheme();
	return (
		<View className="gap-3">
			{LEARNING_DAYS.flatMap((day) => {
				const dayEntries = entries
					.filter((entry) => entry.dayOfWeek === day.value)
					.sort((a, b) => a.startTime.localeCompare(b.startTime));
				const rows: (WeeklyLearningTime | undefined)[] = dayEntries.length
					? dayEntries
					: [undefined];
				return rows.map((entry) => {
					const key = entry?.id ?? `empty-${day.value}`;
					const card = (
						<Surface
							key={key}
							className="min-h-18 flex-row items-center border border-border px-5 py-3"
						>
							<View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
								<Text className="font-poppins font-semibold text-body-4 text-text">
									{day.abbreviation}
								</Text>
							</View>
							<View className="ml-4 flex-1">
								<Text className="font-poppins font-semibold text-body-2 text-text">
									{day.label}
								</Text>
								<Text className="mt-0.5 font-poppins text-body-4 text-secondary-text">
									{entry
										? `${entry.startTime}–${entry.endTime}`
										: "Noch keine Lernzeit"}
								</Text>
								{entry?.preferenceStatus === "systemDefault" ? (
									<Text className="font-poppins text-body-5 text-primary">
										Vorschlag
									</Text>
								) : null}
							</View>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={
									entry
										? `${day.label}, Lernzeit ${entry.startTime} bis ${entry.endTime} bearbeiten`
										: `Lernzeit für ${day.label} hinzufügen`
								}
								className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
								onPress={() => (entry ? onEdit(entry) : onAdd(day.value))}
							>
								<Pencil size={19} color={colors.text} strokeWidth={2} />
							</Pressable>
						</Surface>
					);
					return entry ? (
						<ReanimatedSwipeable
							key={key}
							overshootRight={false}
							rightThreshold={40}
							renderRightActions={(_progress, _translation, swipeable) => (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={`${day.label}, Lernzeit ${entry.startTime} bis ${entry.endTime} löschen`}
									className="ml-2 w-24 items-center justify-center rounded-card bg-destructive"
									onPress={() => {
										swipeable.close();
										onRemove(entry);
									}}
								>
									<Trash2 size={22} color="#FFFFFF" strokeWidth={2} />
									<Text className="mt-1 font-poppins text-body-4 text-white">
										Löschen
									</Text>
								</Pressable>
							)}
						>
							{card}
						</ReanimatedSwipeable>
					) : (
						<View key={key}>{card}</View>
					);
				});
			})}
		</View>
	);
}

export type { WeeklyLearningTime };
export { WeeklyLearningTimes };
