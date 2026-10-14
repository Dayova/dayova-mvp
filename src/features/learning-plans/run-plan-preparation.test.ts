import { describe, expect, test, vi } from "vitest";
import { runPlanPreparation } from "./run-plan-preparation";

function setup() {
	return {
		questionsReady: false,
		scopeConfirmed: false,
		isCancelled: vi.fn(() => false),
		onStage: vi.fn(),
		analyze: vi.fn(async () => {}),
		confirm: vi.fn(async () => {}),
		prepare: vi.fn(async () => {}),
	};
}

describe("unified plan preparation", () => {
	test("waits for analysis and scope before preparing the plan", async () => {
		const options = setup();
		let finishAnalysis = () => {};
		options.analyze.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishAnalysis = resolve;
				}),
		);
		const pending = runPlanPreparation(options);
		expect(options.confirm).not.toHaveBeenCalled();
		expect(options.prepare).not.toHaveBeenCalled();
		finishAnalysis();
		await pending;
		expect(options.confirm).toHaveBeenCalledOnce();
		expect(options.prepare).toHaveBeenCalledOnce();
		expect(options.onStage.mock.calls.flat()).toEqual([0, 1, 2, 3]);
	});
	test("resumes after analysis and confirmation without repeating either", async () => {
		const options = { ...setup(), questionsReady: true, scopeConfirmed: true };
		await runPlanPreparation(options);
		expect(options.analyze).not.toHaveBeenCalled();
		expect(options.confirm).not.toHaveBeenCalled();
		expect(options.prepare).toHaveBeenCalledOnce();
	});
	test("does not start later stages when the user leaves during analysis", async () => {
		const options = setup();
		options.analyze.mockImplementation(async () => {
			options.isCancelled.mockReturnValue(true);
		});
		await runPlanPreparation(options);
		expect(options.confirm).not.toHaveBeenCalled();
		expect(options.prepare).not.toHaveBeenCalled();
	});
	test("surfaces preparation errors without marking the plan complete", async () => {
		const options = setup();
		options.prepare.mockRejectedValue(new Error("Try again"));
		await expect(runPlanPreparation(options)).rejects.toThrow("Try again");
		expect(options.onStage).not.toHaveBeenCalledWith(3);
	});
});
