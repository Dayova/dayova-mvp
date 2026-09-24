import { useLocalSearchParams } from "expo-router";
import type { Id } from "#convex/_generated/dataModel";
import { AnalyticsScreen } from "~/features/analytics/analytics-screen";

export default function AnalyticsRoute() {
	const { planId } = useLocalSearchParams<{ planId?: string }>();

	return (
		<AnalyticsScreen
			key={planId ?? "default"}
			initialPlanId={planId as Id<"learningPlans"> | undefined}
		/>
	);
}
