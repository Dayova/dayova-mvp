import { ActivityIndicator, View } from "react-native";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

export function ExamCreationActions({
	canCreateExam,
	canCreateLearningPlan,
	isCheckingLearningPlanAvailability,
	isCreating,
	onCreateExam,
	onCreateLearningPlan,
}: {
	canCreateExam: boolean;
	canCreateLearningPlan: boolean;
	isCheckingLearningPlanAvailability: boolean;
	isCreating: boolean;
	onCreateExam: () => void;
	onCreateLearningPlan: () => void;
}) {
	const isBusy = isCreating || isCheckingLearningPlanAvailability;

	return (
		<View className="flex-row gap-3">
			<Button
				accessibilityState={{
					busy: isBusy,
					disabled: !canCreateExam || isBusy,
				}}
				className="flex-1"
				variant="neutral"
				disabled={!canCreateExam || isBusy}
				onPress={onCreateExam}
			>
				<Text>Eintragen</Text>
			</Button>
			<Button
				accessibilityLabel={
					isCheckingLearningPlanAvailability
						? "Lernplan, Lernzeit wird geprüft"
						: "Lernplan"
				}
				accessibilityState={{
					busy: isBusy,
					disabled: !canCreateLearningPlan || isBusy,
				}}
				className="flex-1"
				disabled={!canCreateLearningPlan || isBusy}
				onPress={onCreateLearningPlan}
			>
				{isCheckingLearningPlanAvailability ? (
					<ActivityIndicator color="#FFFFFF" />
				) : (
					<Text>Lernplan</Text>
				)}
			</Button>
		</View>
	);
}
