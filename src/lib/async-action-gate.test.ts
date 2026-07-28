import { describe, expect, test, vi } from "vitest";
import {
	createAsyncActionGate,
	createKeyedAsyncActionGate,
} from "./async-action-gate";

describe("createAsyncActionGate", () => {
	test("runs at most one transaction until the active action settles", async () => {
		let finish: (() => void) | undefined;
		const transaction = vi.fn<() => Promise<void>>();
		transaction
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finish = resolve;
					}),
			)
			.mockResolvedValue(undefined);
		const gate = createAsyncActionGate();

		const firstRun = gate.run(transaction);
		const secondRun = gate.run(transaction);

		expect(gate.isRunning).toBe(true);
		expect(transaction).toHaveBeenCalledOnce();
		await expect(secondRun).resolves.toEqual({ status: "skipped" });
		expect(finish).toBeDefined();
		if (!finish) {
			throw new Error(
				"Expected the active transaction to expose its resolver.",
			);
		}
		finish();
		await expect(firstRun).resolves.toEqual({
			status: "completed",
			value: undefined,
		});
		expect(gate.isRunning).toBe(false);

		await gate.run(transaction);
		expect(transaction).toHaveBeenCalledTimes(2);
	});
});

describe("createKeyedAsyncActionGate", () => {
	test("runs different preference keys concurrently without duplicating one key", async () => {
		let finishExamUpdate: (() => void) | undefined;
		const examUpdate = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishExamUpdate = resolve;
				}),
		);
		const learningTimeUpdate = vi.fn(async () => undefined);
		const gate = createKeyedAsyncActionGate<
			"beforeExamEnabled" | "beforeLearningTimeEnabled"
		>();

		const firstExamRun = gate.run("beforeExamEnabled", examUpdate);
		const duplicateExamRun = gate.run("beforeExamEnabled", examUpdate);
		const learningTimeRun = gate.run(
			"beforeLearningTimeEnabled",
			learningTimeUpdate,
		);

		expect(examUpdate).toHaveBeenCalledOnce();
		expect(learningTimeUpdate).toHaveBeenCalledOnce();
		await expect(duplicateExamRun).resolves.toEqual({ status: "skipped" });
		await expect(learningTimeRun).resolves.toEqual({
			status: "completed",
			value: undefined,
		});
		expect(finishExamUpdate).toBeDefined();
		if (!finishExamUpdate) {
			throw new Error("Expected the exam update to expose its resolver.");
		}
		finishExamUpdate();
		await expect(firstExamRun).resolves.toEqual({
			status: "completed",
			value: undefined,
		});
	});
});
