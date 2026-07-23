import { Stack } from "expo-router";
import { LearningPlanCreationProgressShell } from "~/features/learning-plans/creation-progress-shell";

export default function LearningPlanCreationLayout() {
	return (
		<LearningPlanCreationProgressShell>
			<Stack screenOptions={{ headerShown: false }} />
		</LearningPlanCreationProgressShell>
	);
}
