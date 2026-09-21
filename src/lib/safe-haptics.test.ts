import * as Haptics from "expo-haptics";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { triggerSelectionHaptic, triggerSuccessHaptic } from "./safe-haptics";

vi.mock("expo-haptics", () => ({
	NotificationFeedbackType: { Success: "success" },
	notificationAsync: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

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

describe("triggerSuccessHaptic", () => {
	it("triggers success feedback on iOS", async () => {
		const notificationAsync = vi.mocked(Haptics.notificationAsync);
		notificationAsync.mockResolvedValue(undefined);

		await triggerSuccessHaptic({
			platform: "ios",
		});

		expect(notificationAsync).toHaveBeenCalledOnce();
		expect(notificationAsync).toHaveBeenCalledWith(
			Haptics.NotificationFeedbackType.Success,
		);
	});

	it("does not surface native haptics failures", async () => {
		const notificationAsync = vi.mocked(Haptics.notificationAsync);
		notificationAsync.mockRejectedValue(
			new Error("Success haptics are unavailable"),
		);

		await expect(
			triggerSuccessHaptic({
				platform: "ios",
			}),
		).resolves.toBeUndefined();
		expect(notificationAsync).toHaveBeenCalledOnce();
	});

	it("does not trigger success feedback on other platforms", async () => {
		const notificationAsync = vi.mocked(Haptics.notificationAsync);
		notificationAsync.mockResolvedValue(undefined);

		await triggerSuccessHaptic({
			platform: "android",
		});

		expect(notificationAsync).not.toHaveBeenCalled();
	});
});
