import { Pressable, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { Button } from "~/components/ui/button";
import { Clock3, Pencil } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
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
	onRemove: (entry: WeeklyLearningTime) => void;
	disabled?: boolean;
};

function WeeklyLearningTimes({
	entries,
	onAdd,
	onEdit,
	onRemove,
	disabled = false,
}: WeeklyLearningTimesProps) {
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();
	if (entries.length === 0)
		return (
			<Surface className="items-center border border-border px-6 py-10">
				<View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
					<Clock3 size={26} color={colors.text} strokeWidth={2} />
				</View>
				<Text
					accessibilityRole="header"
					className="mt-5 text-center font-semibold text-body-2 text-text"
				>
					Noch keine Lernzeiten
				</Text>
				<Text className="mt-2 text-center text-body-4 text-secondary-text">
					Lege deine erste Lernzeit an. So weiß Dayova, wann du regelmäßig Zeit
					zum Lernen hast.
				</Text>
				<Button
					disabled={disabled}
					onPress={() => onAdd(1)}
					className="mt-5 self-stretch"
				>
					<Text>Lernzeit hinzufügen</Text>
				</Button>
			</Surface>
		);
	const sortedEntries = [...entries].sort(
		(a, b) =>
			a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
	);
	return (
		<View className="gap-3">
			{sortedEntries.map((entry) => {
				const day = LEARNING_DAYS.find((day) => day.value === entry.dayOfWeek);
				const dayLabel = day?.label ?? "Lerntag";
				const label = `${dayLabel}, ${entry.startTime} bis ${entry.endTime}`;
				return (
					<ReanimatedSwipeable
						key={entry.id}
						enabled={!disabled}
						overshootRight={false}
						rightThreshold={40}
						renderRightActions={(_progress, _translation, swipeable) => (
							<Button
								accessibilityLabel={`${label} löschen`}
								variant="destructive-outline"
								className="ml-2 min-w-24 self-stretch px-3"
								disabled={disabled}
								onPress={() => {
									swipeable.close();
									if (!disabled) onRemove(entry);
								}}
							>
								<Text className="shrink text-center">Löschen</Text>
							</Button>
						)}
					>
						<Surface
							className={cn(
								"min-h-18 border border-border px-5 py-3",
								!shouldStackInlineContent && "flex-row items-center",
							)}
						>
							<View className="flex-1 flex-row items-center gap-4">
								<View className="min-h-10 min-w-10 items-center justify-center rounded-full bg-muted px-2 py-2">
									<Text className="font-semibold text-body-4 text-text">
										{day?.abbreviation ?? "–"}
									</Text>
								</View>
								<View className="flex-1 gap-1">
									<Text className="font-semibold text-body-2 text-text">
										{dayLabel}
									</Text>
									<Text className="text-body-4 text-secondary-text">
										{entry.startTime}–{entry.endTime} Uhr
									</Text>
								</View>
							</View>
							<View
								className={cn(
									"flex-row",
									shouldStackInlineContent && "mt-2 self-end",
								)}
							>
								<Pressable
									accessibilityLabel={`${label} bearbeiten`}
									accessibilityHint="Weitere Aktion: Lernzeit löschen."
									accessibilityActions={[
										{ name: "delete", label: `${label} löschen` },
									]}
									onAccessibilityAction={(event) => {
										if (!disabled && event.nativeEvent.actionName === "delete")
											onRemove(entry);
									}}
									accessibilityRole="button"
									disabled={disabled}
									accessibilityState={{ disabled }}
									className="h-11 w-11 items-center justify-center rounded-full active:bg-muted disabled:opacity-50"
									onPress={() => onEdit(entry)}
								>
									<Pencil size={19} color={colors.text} strokeWidth={2} />
								</Pressable>
							</View>
						</Surface>
					</ReanimatedSwipeable>
				);
			})}
		</View>
	);
}

export type { WeeklyLearningTime };
export { WeeklyLearningTimes };
