import { Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Button } from "~/components/ui/button";
import { Pencil, TimeManagement, Trash2 } from "~/components/ui/icon";
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
	if (entries.length === 0) {
		return (
			<Surface className="items-center border border-border px-6 py-10">
				<View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
					<TimeManagement size={26} color={colors.text} strokeWidth={2} />
				</View>
				<Text className="mt-5 text-center font-poppins font-semibold text-body-2 text-text">
					Noch keine Lernzeiten
				</Text>
				<Text className="mt-2 text-center font-poppins text-body-4 text-secondary-text">
					Lege fest, wann Dayova deine Lerneinheiten einplanen kann.
				</Text>
				<Button
					accessibilityLabel="Jetzt Lernzeit hinzufügen"
					className="mt-5 w-full"
					onPress={() => onAdd(1)}
				>
					<Text>Jetzt Lernzeit hinzufügen</Text>
				</Button>
			</Surface>
		);
	}

	const sortedEntries = [...entries].sort(
		(a, b) =>
			a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
	);

	return (
		<View className="gap-3">
			{sortedEntries.map((entry) => {
				const day =
					LEARNING_DAYS.find(
						(candidate) => candidate.value === entry.dayOfWeek,
					) ?? LEARNING_DAYS[0];
				const card = (
					<Surface className="min-h-18 flex-row items-center border border-border px-5 py-3">
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
								{entry.startTime}–{entry.endTime}
							</Text>
							{entry.preferenceStatus === "systemDefault" ? (
								<Text className="font-poppins text-body-5 text-primary">
									Vorschlag
								</Text>
							) : null}
						</View>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`${day.label}, Lernzeit ${entry.startTime} bis ${entry.endTime} bearbeiten`}
							className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
							onPress={() => onEdit(entry)}
						>
							<Pencil size={19} color={colors.text} strokeWidth={2} />
						</Pressable>
					</Surface>
				);
				return (
					<ReanimatedSwipeable
						key={entry.id}
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
				);
			})}
		</View>
	);
}

export type { WeeklyLearningTime };
export { WeeklyLearningTimes };
