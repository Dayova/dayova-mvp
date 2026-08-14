import { View, type ViewProps } from "react-native";
import { BackButton } from "~/components/ui/button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import { Text } from "~/components/ui/text";
import {
	getSafeLearningPlanCreationProgress,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "~/features/learning-plans/creation-progress";
import { cn } from "~/lib/utils";

export function LearningPlanCreationProgressHeader({
	currentStep,
	onBack,
	totalSteps = LEARNING_PLAN_CREATION_TOTAL_STEPS,
	title = "Lernplan erstellen",
	className,
	...props
}: ViewProps & {
	currentStep: number;
	onBack: () => void;
	totalSteps?: number;
	title?: string;
}) {
	const { currentStep: safeStep, totalSteps: safeTotalSteps } =
		getSafeLearningPlanCreationProgress({ currentStep, totalSteps });

	return (
		<View className={cn("flex-row items-center gap-4", className)} {...props}>
			<BackButton onPress={onBack} />
			<View className="flex-1 gap-2">
				<View className="flex-row items-center justify-between gap-3">
					<Text
						accessibilityRole="header"
						className="flex-1 font-poppins font-semibold text-body-3 text-text"
						numberOfLines={1}
					>
						{title}
					</Text>
					<Text
						className="font-poppins text-body-4 text-secondary-text"
						// Tabular figures are a native text-rendering setting, not static layout.
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{safeStep} von {safeTotalSteps}
					</Text>
				</View>
				<FlowProgressBar
					progress={safeStep / safeTotalSteps}
					accessibilityRole="progressbar"
					accessibilityValue={{
						min: 1,
						max: safeTotalSteps,
						now: safeStep,
						text: `Schritt ${safeStep} von ${safeTotalSteps}`,
					}}
				/>
			</View>
		</View>
	);
}
