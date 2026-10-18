import { Redirect, useLocalSearchParams } from "expo-router";

// Keep existing links resumable while creation uses one preparation screen.
export default function LearningPlanPreparationRedirect() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	return <Redirect href={`/learning-plans/${planId}/analysis`} />;
}
