import { ActivityIndicator, View } from "react-native";
import { Check, Clock3 } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

export function LearningAvailabilityStep({
	availableStudyMinutes,
	examDateLabel,
}: {
	availableStudyMinutes: number | null;
	examDateLabel: string;
}) {
	const hasUsableLearningTime =
		availableStudyMinutes !== null && availableStudyMinutes >= 10;

	return (
		<View className="flex-1 pt-2">
			<Surface className="rounded-[32px] px-6 py-7" variant="soft">
				<View className="h-14 w-14 items-center justify-center rounded-[20px] bg-system-subtle">
					{availableStudyMinutes === null ? (
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.primary} />
					) : hasUsableLearningTime ? (
						<Check size={27} color="#34C759" strokeWidth={2.5} />
					) : (
						<Clock3
							size={27}
							color={DAYOVA_DESIGN_SYSTEM.colors.primary}
							strokeWidth={2.1}
						/>
					)}
				</View>
				<Text className="mt-5 font-poppins font-semibold text-body-2 text-text">
					{availableStudyMinutes === null
						? "Wir prüfen deine Lernzeiten"
						: hasUsableLearningTime
							? "Lernzeit gefunden"
							: "Ein Zeitfenster reicht für den Anfang"}
				</Text>
				<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
					{availableStudyMinutes === null
						? "Das dauert nur einen Moment."
						: hasUsableLearningTime
							? `Dayova kann deinen Lernweg vor dem ${examDateLabel} in deine gespeicherten Zeiten einplanen.`
							: `Lege mindestens ein Zeitfenster vor dem ${examDateLabel} fest. Dayova plant später nur innerhalb dieser Zeiten.`}
				</Text>
				{availableStudyMinutes !== null && !hasUsableLearningTime ? (
					<Text className="mt-4 font-poppins text-body-4 text-secondary-text">
						Du entscheidest hier nur, wann Lernen grundsätzlich möglich ist –
						noch nicht, wie viel du schaffen musst.
					</Text>
				) : null}
			</Surface>
		</View>
	);
}
