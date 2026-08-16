import { Redirect, useLocalSearchParams } from "expo-router";
import type { Id } from "#convex/_generated/dataModel";

export default function LegacyLearningPlanWorkloadRedirect() {
	const params = useLocalSearchParams<{ planId?: string }>();
	const planId = params.planId as Id<"learningPlans"> | undefined;

	return (
		<Redirect
			href={
				planId
					? (`/learning-plans/${planId}/generating` as const)
					: ("/home" as const)
			}
		/>
	);
}
