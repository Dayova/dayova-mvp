import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createPlanPreparationRunner } from "./run-plan-preparation";

function deferred() {
	let resolve = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
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

test("an eight-second result finishes at eight seconds, without animation delays", async () => {
	const run = createPlanPreparationRunner();
	const options = setup();
	const analysis = deferred();
	options.analyze.mockReturnValue(analysis.promise);
	const completed = vi.fn();
	const pending = run(options).then(completed);
	await vi.advanceTimersByTimeAsync(8000);
	expect(completed).not.toHaveBeenCalled();
	expect(options.onStage.mock.calls.flat()).toEqual([0, 1]);
	analysis.resolve();
	await pending;
	expect(completed).toHaveBeenCalledWith(true);
	expect(options.onStage.mock.calls.flat()).toEqual([0, 1, 3]);
	expect(vi.getTimerCount()).toBe(0);
});

test("uses previous successful duration to pace the next run in thirds", async () => {
	const run = createPlanPreparationRunner();
	const first = setup();
	const analysis = deferred();
	first.analyze.mockReturnValue(analysis.promise);
	const pending = run(first);
	await vi.advanceTimersByTimeAsync(9000);
	analysis.resolve();
	await pending;
	const second = setup();
	const nextAnalysis = deferred();
	second.analyze.mockReturnValue(nextAnalysis.promise);
	const next = run(second);
	await vi.advanceTimersByTimeAsync(2999);
	expect(second.onStage.mock.calls.flat()).toEqual([0]);
	await vi.advanceTimersByTimeAsync(1);
	expect(second.onStage.mock.calls.flat()).toEqual([0, 1]);
	await vi.advanceTimersByTimeAsync(3000);
	expect(second.onStage.mock.calls.flat()).toEqual([0, 1, 2]);
	expect(second.confirm).not.toHaveBeenCalled();
	await vi.advanceTimersByTimeAsync(30000);
	expect(second.onStage).not.toHaveBeenCalledWith(3);
	nextAnalysis.resolve();
	expect(await next).toBe(true);
});

test("instant results never wait for presentation timers", async () => {
	const options = setup();
	expect(await createPlanPreparationRunner()(options)).toBe(true);
	expect(options.onStage.mock.calls.flat()).toEqual([0, 3]);
	expect(vi.getTimerCount()).toBe(0);
});

test("backend dependencies remain sequential", async () => {
	const options = setup();
	const analysis = deferred();
	const confirmation = deferred();
	options.analyze.mockReturnValue(analysis.promise);
	options.confirm.mockReturnValue(confirmation.promise);
	const pending = createPlanPreparationRunner()(options);
	await vi.advanceTimersByTimeAsync(10000);
	expect(options.confirm).not.toHaveBeenCalled();
	analysis.resolve();
	await vi.advanceTimersByTimeAsync(0);
	expect(options.confirm).toHaveBeenCalledOnce();
	expect(options.prepare).not.toHaveBeenCalled();
	confirmation.resolve();
	await pending;
	expect(options.prepare).toHaveBeenCalledOnce();
});

test("last item waits for final preparation even after the estimate elapses", async () => {
	const options = setup();
	const preparation = deferred();
	options.prepare.mockReturnValue(preparation.promise);
	const completed = vi.fn();
	const pending = createPlanPreparationRunner()(options).then(completed);
	await vi.advanceTimersByTimeAsync(60000);
	expect(options.onStage).toHaveBeenLastCalledWith(2);
	expect(completed).not.toHaveBeenCalled();
	preparation.resolve();
	await pending;
	expect(completed).toHaveBeenCalledWith(true);
});

test("resume skips completed backend and visual stages", async () => {
	const options = { ...setup(), questionsReady: true, scopeConfirmed: true };
	expect(await createPlanPreparationRunner()(options)).toBe(true);
	expect(options.analyze).not.toHaveBeenCalled();
	expect(options.confirm).not.toHaveBeenCalled();
	expect(options.onStage.mock.calls.flat()).toEqual([2, 3]);
});

test("leaving stops estimated progress and subsequent requests", async () => {
	const options = setup();
	const analysis = deferred();
	options.analyze.mockReturnValue(analysis.promise);
	const pending = createPlanPreparationRunner()(options);
	options.isCancelled.mockReturnValue(true);
	await vi.advanceTimersByTimeAsync(30000);
	analysis.resolve();
	expect(await pending).toBe(false);
	expect(options.onStage.mock.calls.flat()).toEqual([0]);
	expect(options.confirm).not.toHaveBeenCalled();
	expect(vi.getTimerCount()).toBe(0);
});

test.each([
	"analyze",
	"confirm",
	"prepare",
] as const)("%s failure stops timers without completion", async (step) => {
	const options = setup();
	options[step].mockRejectedValue(new Error("Failed"));
	await expect(createPlanPreparationRunner()(options)).rejects.toThrow(
		"Failed",
	);
	await vi.advanceTimersByTimeAsync(30000);
	expect(options.onStage.mock.calls.flat()).toEqual([0]);
	expect(vi.getTimerCount()).toBe(0);
});
