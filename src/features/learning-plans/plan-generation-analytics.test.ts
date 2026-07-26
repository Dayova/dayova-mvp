import { describe, expect, it, vi } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import { setDiagnosticSink } from "~/lib/diagnostics";
import { generatePlanWithAnalytics } from "./plan-generation-analytics";

const learningPlanId = "plan-1" as Id<"learningPlans">;
const generationArgs = {
	learningPlanId,
	answers: [{ questionId: "question-1", answer: "answer-1" }],
	sessionCompositionVariant: "rehearsal" as const,
};

describe("generatePlanWithAnalytics", () => {
	it("captures one generated-plan event after successful generation", async () => {
		const callOrder: string[] = [];
		const generatePlan = vi.fn(async () => {
			callOrder.push("generate");
			return { sessionCount: 4 };
		});
		const capture = vi.fn(() => {
			callOrder.push("capture");
		});

		await generatePlanWithAnalytics({
			generatePlan,
			capture,
			args: generationArgs,
		});

		expect(generatePlan).toHaveBeenCalledOnce();
		expect(generatePlan).toHaveBeenCalledWith(generationArgs);
		expect(capture).toHaveBeenCalledOnce();
		expect(capture).toHaveBeenCalledWith("study_plan_generated", {
			learning_plan_id: learningPlanId,
			session_count: 4,
		});
		expect(callOrder).toEqual(["generate", "capture"]);
	});

	it("does not capture when generation fails", async () => {
		const generationError = new Error("generation failed");
		const generatePlan = vi.fn().mockRejectedValue(generationError);
		const capture = vi.fn();

		await expect(
			generatePlanWithAnalytics({
				generatePlan,
				capture,
				args: generationArgs,
			}),
		).rejects.toBe(generationError);

		expect(capture).not.toHaveBeenCalled();
	});

	it("handles a rejected capture without failing successful generation", async () => {
		const captureError = new Error("capture failed");
		const diagnosticSink = vi.fn();
		const restoreDiagnosticSink = setDiagnosticSink(diagnosticSink);

		try {
			const result = await generatePlanWithAnalytics({
				generatePlan: vi.fn().mockResolvedValue({ sessionCount: 4 }),
				capture: vi.fn().mockRejectedValue(captureError),
				args: generationArgs,
			});
			await Promise.resolve();

			expect(result).toEqual({ sessionCount: 4 });
			expect(diagnosticSink).toHaveBeenCalledWith(
				expect.objectContaining({
					level: "warn",
					message: "Failed to capture generated-plan analytics.",
					source: "analytics.studyPlanGenerated",
					error: captureError,
				}),
			);
		} finally {
			restoreDiagnosticSink();
		}
	});
});
