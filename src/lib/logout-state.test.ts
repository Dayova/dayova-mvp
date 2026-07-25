import { describe, expect, test, vi } from "vitest";
import { signOutAndResetState } from "./logout-state";

describe("signOutAndResetState", () => {
	test("resets local auth state only after the remote session is signed out", async () => {
		const events: string[] = [];

		await signOutAndResetState(
			async () => {
				events.push("signed-out");
			},
			() => events.push("local-reset"),
		);

		expect(events).toEqual(["signed-out", "local-reset"]);
	});

	test("preserves local auth state when sign-out fails", async () => {
		const resetLocalState = vi.fn();

		await expect(
			signOutAndResetState(async () => {
				throw new Error("offline");
			}, resetLocalState),
		).rejects.toThrow("offline");
		expect(resetLocalState).not.toHaveBeenCalled();
	});
});
