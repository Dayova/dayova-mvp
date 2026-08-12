import { useLocalSearchParams } from "expo-router";
import type { Id } from "#convex/_generated/dataModel";
import { AnalyticsDetailScreen } from "~/features/analytics/analytics-screen";

export default function NextStepAnalysisRoute() {
	const { planId } = useLocalSearchParams<{ planId?: string }>();

	return (
		<AnalyticsDetailScreen
			planId={planId as Id<"learningPlans"> | undefined}
			section="nextStep"
		/>
	);
}
