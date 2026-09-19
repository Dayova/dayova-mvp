import { useState } from "react";
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
	const [hiddenEmptyDays, setHiddenEmptyDays] = useState<ReadonlySet<number>>(
		() => new Set(),
	);
	const hideEmptyDay = (dayOfWeek: number) => {
		setHiddenEmptyDays((current) => {
			const next = new Set(current);
			next.add(dayOfWeek);
			return next;
		});
	};
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
	return (
		<View className="gap-3">
			{LEARNING_DAYS.filter(
				(day) =>
					entries.some((entry) => entry.dayOfWeek === day.value) ||
					!hiddenEmptyDays.has(day.value),
			).flatMap((day) => {
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
					return (
						<ReanimatedSwipeable
							key={key}
							overshootRight={false}
							rightThreshold={40}
							renderRightActions={(_progress, _translation, swipeable) => (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={
										entry
											? `${day.label}, Lernzeit ${entry.startTime} bis ${entry.endTime} löschen`
											: `${day.label} aus den Lernzeiten entfernen`
									}
									className="ml-2 w-24 items-center justify-center rounded-card bg-destructive"
									onPress={() => {
										swipeable.close();
										hideEmptyDay(day.value);
										if (entry) onRemove(entry);
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
				});
			})}
		</View>
	);
}

export type { WeeklyLearningTime };
export { WeeklyLearningTimes };
