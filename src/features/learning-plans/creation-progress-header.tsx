import { View, type ViewProps } from "react-native";
import { BackButton } from "~/components/ui/button";
import { CloseButton } from "~/components/ui/close-button";
import { FlowProgressBar } from "~/components/ui/flow-progress-bar";
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
			<BackButton onPress={onBack} />
			<FlowProgressBar
				accessible
				className="flex-1"
				progress={safeProgress / safeTotalSteps}
				accessibilityRole="progressbar"
				accessibilityValue={{
					min: 0,
					max: 100,
					now: progressPercentage,
					text: `Fortschritt ${progressPercentage} Prozent`,
				}}
			/>
			<View className="h-12 w-12 items-center justify-center">
				<CloseButton
					onPress={onClose}
					disabled={closeDisabled}
					accessibilityState={{ disabled: closeDisabled }}
				/>
			</View>
		</View>
	);
}
