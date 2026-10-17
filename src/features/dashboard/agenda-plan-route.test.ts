import { expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { getAgendaPlanRoute } from "./agenda-plan-route";

test("agenda opens the plan rather than its session", () => {
	expect(
		getAgendaPlanRoute({
			id: "session" as Id<"learningPlanSessions">,
			relatedLearningPlanId: "plan" as Id<"learningPlans">,
			relatedLearningPlanSessionId: "session" as Id<"learningPlanSessions">,
		}),
	).toBe("/learning-plans/plan?returnTo=%2Fhome");
});
test("entries without a plan retain their existing fallback", () => {
	expect(getAgendaPlanRoute({ id: "entry" as Id<"dayEntries"> })).toBeNull();
});
