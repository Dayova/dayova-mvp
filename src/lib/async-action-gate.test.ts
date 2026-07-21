import { describe, expect, test, vi } from "vitest";
import { createAsyncActionGate } from "./async-action-gate";

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
