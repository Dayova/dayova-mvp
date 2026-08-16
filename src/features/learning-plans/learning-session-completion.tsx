import { ActivityIndicator, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button } from "~/components/ui/button";
import { BookOpen, Check, ClipboardEdit, Pencil } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { PracticeCompletionCard } from "~/features/learning-plans/practice-completion-card";
import type { LearningSessionContentSnapshot } from "~/features/learning-plans/types";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { cn } from "~/lib/utils";

export function LearningSessionCompletion({
	phase,
	isDiagnostic,
	durationMinutes,
	correctCount,
	attemptCount,
	onContinueLearning,
	onPrimary,
	isBusy,
}: {
	phase: LearningSessionContentSnapshot["session"]["phase"];
	isDiagnostic: boolean;
	durationMinutes: number;
	correctCount: number;
	attemptCount: number;
	onContinueLearning: () => void;
	onPrimary: () => void;
	isBusy: boolean;
}) {
	const isTheory = phase === "theory";
	const isPraxis = phase === "rehearsal";
	if (isPraxis && !isDiagnostic) {
		return (
			<PracticeCompletionCard
				durationMinutes={durationMinutes}
				correctCount={correctCount}
				attemptCount={attemptCount}
				onRepeat={onContinueLearning}
				onAnalysis={onPrimary}
				isBusy={isBusy}
			/>
		);
	}

	let title = "Übung abgeschlossen";
	let description =
		"Du hast alle Aufgaben geschafft. Sieh dir jetzt deine Auswertung in der Analyse an.";
	let completionLabel = "Übung geschafft";
	let Icon = Pencil;
	let iconClassName = "bg-ueben-subtle";
	let iconColor: string = DAYOVA_DESIGN_SYSTEM.colors.ueben;

	if (isTheory) {
		title = "Theorie abgeschlossen";
		description =
			"Du hast alle Themen dieser Theorieeinheit geschafft. Wiederhole sie noch einmal oder gehe zum nächsten Schritt.";
		completionLabel = "Theorie geschafft";
		Icon = BookOpen;
		iconClassName = "bg-theorie-subtle";
		iconColor = DAYOVA_DESIGN_SYSTEM.colors.theorie;
	}

	if (isDiagnostic) {
		title = "Wissenscheck abgeschlossen";
		description = `Deine ${attemptCount} Antworten aktualisieren deinen Wissensstand. Damit passt Dayova deinen nächsten Lernschritt an.`;
		completionLabel = "Wissensstand erfasst";
		Icon = ClipboardEdit;
		iconClassName = "bg-system-subtle";
		iconColor = DAYOVA_DESIGN_SYSTEM.colors.primary;
	}

	const primaryLabel = isDiagnostic
		? "Auswertung ansehen"
		: isTheory
			? "Theorie abschließen"
			: "Analyse ansehen";

	return (
		<Animated.View
			entering={FadeIn.duration(280)}
			className="flex-1 justify-between py-8"
		>
			<View className="flex-1 items-center justify-center px-2 pb-10">
				<View className="relative">
					<View
						className={cn(
							"h-28 w-28 items-center justify-center rounded-[32px]",
							iconClassName,
						)}
					>
						<Icon size={52} color={iconColor} strokeWidth={2.1} />
					</View>
					<View className="absolute -right-2 -bottom-2 h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-success">
						<Check
							size={20}
							color={DAYOVA_DESIGN_SYSTEM.colors.light1}
							strokeWidth={3}
						/>
					</View>
				</View>

				<View className="mt-8 rounded-full bg-success-subtle px-4 py-2">
					<Text className="font-poppins font-semibold text-body-4 text-success">
						{completionLabel}
					</Text>
				</View>
				<Text
					accessibilityRole="header"
					className="mt-4 text-center font-poppins font-semibold text-heading-2 text-text"
				>
					{title}
				</Text>
				<Text className="mt-3 max-w-[320px] text-center font-poppins text-body-3 text-secondary-text">
					{description}
				</Text>
			</View>

			<View className="gap-3">
				<Button className="w-full" disabled={isBusy} onPress={onPrimary}>
					{isBusy ? (
						<ActivityIndicator color={DAYOVA_DESIGN_SYSTEM.colors.light1} />
					) : (
						<Text>{primaryLabel}</Text>
					)}
				</Button>
				{isTheory ? (
					<Button
						className="w-full"
						disabled={isBusy}
						variant="neutral"
						onPress={onContinueLearning}
					>
						<Text>Noch 10 Min. weiterlernen</Text>
					</Button>
				) : null}
			</View>
		</Animated.View>
	);
}
