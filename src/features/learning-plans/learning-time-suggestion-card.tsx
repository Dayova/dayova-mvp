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
	previousStartTime?: string;
	previousEndTime?: string;
};

const dayLabel = (dayOfWeek: number) =>
	LEARNING_DAYS.find((day) => day.value === dayOfWeek)?.abbreviation ?? "Tag";

export function LearningTimeSuggestionCard({
	entries,
	variant,
	isBusy,
	evidenceSessionCount,
	onConfirm,
	onAdjust,
	onKeep,
	onContinue,
}: {
	entries: SuggestedLearningTime[];
	variant: "initial" | "postDiagnostic" | "behavioral";
	isBusy: boolean;
	evidenceSessionCount?: number;
	plannedStartTime?: string;
	observedStartTime?: string;
	onConfirm: () => void;
	onAdjust: () => void;
	onKeep?: () => void;
	onContinue: () => void;
}) {
	const isReminder = variant === "postDiagnostic";
	const isBehavioral = variant === "behavioral";
	const formatDisplayTime = (time: string) =>
		time === "00:00" ? "Mitternacht" : time;
	const summary = entries
		.map(
			(entry) =>
				`${dayLabel(entry.dayOfWeek)} ${entry.previousStartTime && entry.previousEndTime ? `${entry.previousStartTime}–${formatDisplayTime(entry.previousEndTime)} → ` : ""}${formatDisplayTime(entry.startTime)}–${formatDisplayTime(entry.endTime)}`,
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
						{isBehavioral
							? "Passen diese Lernzeiten besser?"
							: isReminder
								? "Mach deinen Lernplan noch genauer"
								: "Vorgeschlagene Lernzeiten"}
					</Text>
					<Text className="mt-1 font-poppins text-body-4 text-secondary-text">
						{isBehavioral
							? `In deinen letzten ${evidenceSessionCount ?? "mehreren"} abgeschlossenen Lernsessions über mindestens zwei Wochen zeigt sich an diesen Tagen ein anderes Startmuster. Möchtest du die vorgeschlagenen Zeiten ausprobieren? Andere Tage bleiben unverändert. Geändert wird erst nach deiner Zustimmung. Lernen kannst du weiterhin jederzeit.`
							: isReminder
								? "Bestätige oder ändere die vorgeschlagenen Zeiten. Deine bisherigen Fortschritte bleiben erhalten."
								: "Du kannst Lernzeiten jetzt eintragen oder später ergänzen. Bis dahin plant Dayova mit diesen vorgeschlagenen Zeiten. Lernen kannst du jederzeit."}
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
				{isBehavioral && onKeep ? (
					<Pressable
						accessibilityRole="button"
						className="min-h-11 items-center justify-center active:opacity-70"
						disabled={isBusy}
						hitSlop={6}
						onPress={onKeep}
					>
						<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
							Aktuelle Zeiten behalten
						</Text>
					</Pressable>
				) : null}
				<Pressable
					accessibilityRole="button"
					className="min-h-11 items-center justify-center active:opacity-70"
					disabled={isBusy}
					hitSlop={6}
					onPress={onContinue}
				>
					<Text className="font-poppins font-semibold text-body-4 text-secondary-text">
						{isBehavioral
							? "Später erinnern"
							: isReminder
								? "Später"
								: "Weiterlernen"}
					</Text>
				</Pressable>
			</View>
		</Surface>
	);
}

export type { SuggestedLearningTime };
