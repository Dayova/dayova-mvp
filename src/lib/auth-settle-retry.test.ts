import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithAuthSettleRetries } from "./auth-settle-retry";

describe("runWithAuthSettleRetries", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("recovers from a transient backend failure", async () => {
		vi.useFakeTimers();
		const task = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("backend settling"))
			.mockResolvedValue("recorded");

		const resultPromise = runWithAuthSettleRetries(task);
		await vi.runAllTimersAsync();

		await expect(resultPromise).resolves.toEqual({
			ok: true,
			value: "recorded",
		});
		expect(task).toHaveBeenCalledTimes(2);
	});

	it("returns the first and final errors after exhausting retries", async () => {
		vi.useFakeTimers();
		const firstError = new Error("first failure");
		const lastError = new Error("final failure");
		const task = vi
			.fn<() => Promise<never>>()
			.mockRejectedValueOnce(firstError)
			.mockRejectedValueOnce(new Error("second failure"))
			.mockRejectedValueOnce(new Error("third failure"))
			.mockRejectedValueOnce(lastError);

		const resultPromise = runWithAuthSettleRetries(task);
		await vi.runAllTimersAsync();

		await expect(resultPromise).resolves.toEqual({
			ok: false,
			firstError,
			lastError,
		});
		expect(task).toHaveBeenCalledTimes(4);
	});
});
