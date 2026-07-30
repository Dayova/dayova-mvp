import { describe, expect, it, vi } from "vitest";
import { triggerSelectionHaptic } from "./safe-haptics";

describe("triggerSelectionHaptic", () => {
	it("does not surface a missing native haptics module as an unhandled error", async () => {
		const selectionAsync = vi
			.fn()
			.mockRejectedValue(
				new Error(
					"The method or property Haptic.selectionAsync is not available on ios",
				),
			);

		await expect(
			triggerSelectionHaptic({
				platform: "ios",
				selectionAsync,
			}),
		).resolves.toBeUndefined();
		expect(selectionAsync).toHaveBeenCalledOnce();
	});

	it("does not call the native module on other platforms", async () => {
		const selectionAsync = vi.fn().mockResolvedValue(undefined);

		await triggerSelectionHaptic({
			platform: "android",
			selectionAsync,
		});

		expect(selectionAsync).not.toHaveBeenCalled();
	});
});
