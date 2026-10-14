import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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
		await vi.runAllTimersAsync();
		await pending;
		expect(options.confirm).toHaveBeenCalledOnce();
		expect(options.prepare).toHaveBeenCalledOnce();
		expect(options.onStage.mock.calls.flat()).toEqual([0, 1, 2, 3]);
	});
	test("resumes after analysis and confirmation without repeating either", async () => {
		const options = { ...setup(), questionsReady: true, scopeConfirmed: true };
		const pending = runPlanPreparation(options);
		await vi.runAllTimersAsync();
		await pending;
		expect(options.analyze).not.toHaveBeenCalled();
		expect(options.confirm).not.toHaveBeenCalled();
		expect(options.prepare).toHaveBeenCalledOnce();
	});
	test("does not start later stages when the user leaves during analysis", async () => {
		const options = setup();
		options.analyze.mockImplementation(async () => {
			options.isCancelled.mockReturnValue(true);
		});
		const pending = runPlanPreparation(options);
		await vi.runAllTimersAsync();
		await pending;
		expect(options.confirm).not.toHaveBeenCalled();
		expect(options.prepare).not.toHaveBeenCalled();
	});
	test("surfaces preparation errors without marking the plan complete", async () => {
		const options = setup();
		options.prepare.mockRejectedValue(new Error("Try again"));
		const assertion = expect(runPlanPreparation(options)).rejects.toThrow(
			"Try again",
		);
		await vi.runAllTimersAsync();
		await assertion;
		expect(options.onStage).not.toHaveBeenCalledWith(3);
	});
});

describe("readable preparation sequence", () => {
	test("keeps each fast stage visible before moving to the next", async () => {
		vi.useFakeTimers();
		const options = setup();
		const pending = runPlanPreparation(options);
		await vi.advanceTimersByTimeAsync(1000);
		expect(options.onStage.mock.calls.flat()).toEqual([0]);
		await vi.advanceTimersByTimeAsync(500);
		expect(options.onStage.mock.calls.flat()).toEqual([0, 1]);
		await vi.advanceTimersByTimeAsync(1500);
		expect(options.onStage.mock.calls.flat()).toEqual([0, 1, 2]);
		await vi.advanceTimersByTimeAsync(1500);
		expect(options.onStage.mock.calls.flat()).toEqual([0, 1, 2, 3]);
		await vi.runAllTimersAsync();
		await pending;
	});
});

test("does not mark a slow request complete when the minimum time elapses", async () => {
	const options = setup();
	let finish = () => {};
	options.analyze.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
	);
	const pending = runPlanPreparation(options);
	await vi.advanceTimersByTimeAsync(10000);
	expect(options.onStage.mock.calls.flat()).toEqual([0]);
	expect(options.confirm).not.toHaveBeenCalled();
	finish();
	await vi.runAllTimersAsync();
	expect(await pending).toBe(true);
});

test("leaving during a stage's visible hold stops the next request", async () => {
	const options = setup();
	const pending = runPlanPreparation(options);
	await vi.advanceTimersByTimeAsync(500);
	options.isCancelled.mockReturnValue(true);
	await vi.runAllTimersAsync();
	expect(await pending).toBe(false);
	expect(options.confirm).not.toHaveBeenCalled();
});

test("waits for the completed checklist before allowing navigation", async () => {
	const options = setup();
	const completed = vi.fn();
	const pending = runPlanPreparation(options).then(completed);
	await vi.advanceTimersByTimeAsync(4500);
	expect(options.onStage).toHaveBeenLastCalledWith(3);
	expect(completed).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(600);
	await pending;
	expect(completed).toHaveBeenCalledWith(true);
});

test("keeps the last item loading until all preparation work finishes", async () => {
	const options = setup();
	let finishPreparation = () => {};
	options.prepare.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishPreparation = resolve;
			}),
	);
	const completed = vi.fn();
	const pending = runPlanPreparation(options).then(completed);
	await vi.advanceTimersByTimeAsync(3000);
	expect(options.onStage).toHaveBeenLastCalledWith(2);
	await vi.advanceTimersByTimeAsync(30000);
	expect(options.onStage).toHaveBeenLastCalledWith(2);
	expect(completed).not.toHaveBeenCalled();
	finishPreparation();
	await vi.advanceTimersByTimeAsync(0);
	expect(options.onStage).toHaveBeenLastCalledWith(3);
	expect(completed).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(600);
	await pending;
	expect(completed).toHaveBeenCalledWith(true);
});
