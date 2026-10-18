import { View, type ViewProps } from "react-native";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
import { CreationHeaderButton } from "~/features/learning-plans/creation-header-button";
import {
	getSafeLearningPlanCreationProgress,
	LEARNING_PLAN_CREATION_TOTAL_STEPS,
} from "~/features/learning-plans/creation-progress";
import { cn } from "~/lib/utils";

export function LearningPlanCreationProgressHeader({
	currentStep,
	onBack,
	onClose,
	closeDisabled = false,
	totalSteps = LEARNING_PLAN_CREATION_TOTAL_STEPS,
	className,
	...props
}: ViewProps & {
	currentStep: number;
	onBack: () => void;
	onClose: () => void;
	closeDisabled?: boolean;
	totalSteps?: number;
}) {
	const { currentStep: safeProgress, totalSteps: safeTotalSteps } =
		getSafeLearningPlanCreationProgress({ currentStep, totalSteps });
	const progressPercentage = Math.round((safeProgress / safeTotalSteps) * 100);

	return (
		<View className={cn("flex-row items-center gap-4", className)} {...props}>
			<CreationHeaderButton kind="back" onPress={onBack} />
			<FlowProgressBar
				accessible
				className="h-4 flex-1"
				progress={safeProgress / safeTotalSteps}
				accessibilityRole="progressbar"
				accessibilityValue={{
					min: 0,
					max: 100,
					now: progressPercentage,
					text: `Fortschritt ${progressPercentage} Prozent`,
				}}
			/>
			<CreationHeaderButton
				kind="close"
				onPress={onClose}
				disabled={closeDisabled}
			/>
		</View>
	);
}
