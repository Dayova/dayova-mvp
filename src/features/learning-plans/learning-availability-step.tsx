import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { Check, Clock3 } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

export function LearningAvailabilityStep({
	availabilityStatus,
	examDateLabel,
}: {
	availabilityStatus: "available" | "missing" | "occupied" | null;
	examDateLabel: string;
}) {
	const isLoading = availabilityStatus === null;
	const hasUsableLearningTime = availabilityStatus === "available";
	const isOccupied = availabilityStatus === "occupied";

	return (
		<View className="flex-1 pt-2">
			<Surface className="rounded-[32px] px-6 py-7" variant="soft">
				<View className="h-14 w-14 items-center justify-center rounded-[20px] bg-system-subtle">
					{isLoading ? (
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
					{isLoading
						? "Wir prüfen deine Lernzeiten"
						: hasUsableLearningTime
							? "Lernzeit für deinen Lernweg gefunden"
							: isOccupied
								? "Deine Lernzeiten sind schon belegt"
								: "Noch nicht genug Lernzeit"}
				</Text>
				<Text className="mt-2 font-poppins text-body-3 text-secondary-text">
					{isLoading
						? "Das dauert nur einen Moment."
						: hasUsableLearningTime
							? `Dayova kann deine nächsten Lernschritte vor dem ${examDateLabel} in freie gespeicherte Zeiten einplanen.`
							: isOccupied
								? `Bis zum ${examDateLabel} sind nicht genug freie Lernzeiten für die nächsten zwei Schritte verfügbar.`
								: `Lege vor dem ${examDateLabel} mindestens zwei kurze Lernblöcke fest. Deine Prüfung kannst du trotzdem ohne Lernplan speichern.`}
				</Text>
				{!isLoading && !hasUsableLearningTime ? (
					<Text className="mt-4 font-poppins text-body-4 text-secondary-text">
						{isOccupied
							? "Verschiebe einen bestehenden Lerntermin oder füge eine zusätzliche Lernzeit hinzu."
							: "Du entscheidest hier nur, wann Lernen grundsätzlich möglich ist – noch nicht, wie viel du schaffen musst."}
					</Text>
				) : null}
			</Surface>
		</View>
	);
}

export function LearningAvailabilityAction({
	availabilityStatus,
	onContinue,
	onEditLearningTimes,
}: {
	availabilityStatus: "available" | "missing" | "occupied" | null;
	onContinue: () => void;
	onEditLearningTimes: () => void;
}) {
	const isLoading = availabilityStatus === null;
	const hasUsableLearningTime = availabilityStatus === "available";

	return (
		<Button
			accessibilityState={{ busy: isLoading, disabled: isLoading }}
			className="w-full"
			disabled={isLoading}
			onPress={hasUsableLearningTime ? onContinue : onEditLearningTimes}
		>
			{isLoading ? (
				<ActivityIndicator color="#FFFFFF" />
			) : (
				<Text>{hasUsableLearningTime ? "Weiter" : "Lernzeit eintragen"}</Text>
			)}
		</Button>
	);
}
