import { useLocalSearchParams } from "expo-router";
import type { Id } from "#convex/_generated/dataModel";
import { AnalyticsDetailScreen } from "~/features/analytics/analytics-screen";

export default function KnowledgeAnalysisRoute() {
	const { planId, topicId } = useLocalSearchParams<{
		planId?: string;
		topicId?: string;
	}>();

	return (
		<AnalyticsDetailScreen
			planId={planId as Id<"learningPlans"> | undefined}
			section="knowledge"
			topicId={topicId}
		/>
	);
}
