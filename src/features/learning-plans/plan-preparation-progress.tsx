import { ActivityIndicator, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { AnimatedFlowerLoader } from "~/components/ui/animated-flower-loader";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import { Check } from "~/components/ui/icon";
import { Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";
import type { PreparationStage } from "./run-plan-preparation";

const steps = [
	"Unterlagen analysieren",
	"Prüfungsstoff zusammenstellen",
	"Wissenscheck und Lernweg vorbereiten",
];

export function PlanPreparationProgress({
	stage,
	failed = false,
}: {
	stage: PreparationStage;
	failed?: boolean;
}) {
	const { colors } = useDayovaTheme();
	const reduceMotion = useReducedMotion();
	const busy = !failed && stage < steps.length;
	const status = failed
		? "Vorbereitung unterbrochen"
		: stage >= steps.length
			? "Vorbereitung abgeschlossen"
			: steps[stage];
	return (
		<View className="gap-8">
			<View
				className="items-center"
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<AnimatedFlowerLoader size={192} />
			</View>
			<Text
				accessibilityRole="header"
				accessibilityLabel={`Dein Lernplan entsteht. ${status}`}
				accessibilityLiveRegion="polite"
				accessibilityState={{ busy }}
				className="text-center font-poppins font-semibold text-heading-2 text-text"
			>
				Dein Lernplan entsteht
			</Text>
			<FlowProgressBar
				accessible
				className="h-3"
				progress={stage / steps.length}
				initialProgress={0}
				accessibilityRole="progressbar"
				accessibilityLabel="Lernplan vorbereiten"
				accessibilityValue={{
					min: 0,
					max: steps.length,
					now: stage,
					text: status,
				}}
			/>
			<Surface className="gap-5 rounded-[28px] p-5">
				{steps.map((label, index) => {
					const complete = index < stage;
					const active = index === stage;
					const state = complete
						? "Abgeschlossen"
						: active
							? failed
								? "Unterbrochen"
								: "In Bearbeitung"
							: "Ausstehend";
					return (
						<View
							key={label}
							className="flex-row items-center gap-4"
							accessible
							accessibilityLabel={`${label}: ${state}`}
						>
							<View
								className={cn(
									"h-8 w-8 items-center justify-center rounded-full",
									complete ? "bg-primary" : "border-2 border-border",
								)}
							>
								{complete ? (
									<Check size={18} color={colors.onPrimary} />
								) : active && !failed && !reduceMotion ? (
									<ActivityIndicator color={colors.primary} />
								) : (
									<Text className="font-poppins text-body-3 text-secondary-text">
										{index + 1}
									</Text>
								)}
							</View>
							<Text
								className={cn(
									"flex-1 font-poppins text-body-3",
									active || complete ? "text-text" : "text-secondary-text",
								)}
							>
								{label}
							</Text>
						</View>
					);
				})}
			</Surface>
		</View>
	);
}
