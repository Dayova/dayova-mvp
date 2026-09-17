import { ActivityIndicator, Pressable, View } from "react-native";
import { Button } from "~/components/ui/button";
import { Clock3 } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { LEARNING_DAYS } from "~/features/learning-times/learning-time-days";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

type SuggestedLearningTime = {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
};

const dayLabel = (dayOfWeek: number) =>
	LEARNING_DAYS.find((day) => day.value === dayOfWeek)?.abbreviation ?? "Tag";

export function LearningTimeSuggestionCard({
	entries,
	variant,
	isBusy,
	onConfirm,
	onAdjust,
	onContinue,
}: {
	entries: SuggestedLearningTime[];
	variant: "initial" | "postDiagnostic";
	isBusy: boolean;
	onConfirm: () => void;
	onAdjust: () => void;
	onContinue: () => void;
}) {
	const isReminder = variant === "postDiagnostic";
	const summary = entries
		.map(
			(entry) =>
				`${dayLabel(entry.dayOfWeek)} ${entry.startTime}–${entry.endTime}`,
		)
		.join(" · ");

	return (
		<Surface className="rounded-[28px] px-5 py-5" variant="soft">
			<View className="flex-row items-start gap-3">
				<View className="h-10 w-10 items-center justify-center rounded-[16px] bg-system-subtle">
					<Clock3
						size={20}
						color={DAYOVA_DESIGN_SYSTEM.colors.primary}
						strokeWidth={2.1}
					/>
				</View>
				<View className="min-w-0 flex-1">
					<Text className="font-poppins font-semibold text-body-3 text-text">
						{isReminder
							? "Mach deinen Lernplan noch genauer"
							: "Vorgeschlagene Lernzeiten"}
					</Text>
					<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
						{isReminder
							? "Bestätige oder ändere die vorgeschlagenen Zeiten. Deine bisherigen Fortschritte bleiben erhalten."
							: "Damit du direkt starten kannst, plant Dayova vorerst mit diesen Zeiten. Sie sind noch nicht als deine Präferenz bestätigt."}
					</Text>
				</View>
			</View>

			<View className="mt-4 rounded-[18px] bg-card px-4 py-3">
				<Text
					selectable
					className="font-poppins font-semibold text-body-4 text-text"
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{summary}
				</Text>
				<Text className="mt-1 font-poppins text-body-5 text-primary">
					Vorschlag von Dayova
				</Text>
			</View>

			<View className="mt-4 gap-3">
				<Button disabled={isBusy} onPress={onConfirm}>
					{isBusy ? (
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
					) : (
						<Text>Zeiten übernehmen</Text>
					)}
				</Button>
				<Button disabled={isBusy} onPress={onAdjust} variant="neutral">
					<Text>Jetzt anpassen</Text>
				</Button>
				<Pressable
					accessibilityRole="button"
					className="min-h-11 items-center justify-center active:opacity-70"
					disabled={isBusy}
					hitSlop={6}
					onPress={onContinue}
				>
					<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
						{isReminder ? "Später" : "Weiterlernen"}
					</Text>
				</Pressable>
			</View>
		</Surface>
	);
}

export type { SuggestedLearningTime };
