import { describe, expect, jest, test } from "@jest/globals";
import { createPendingOnboardingSyncStorage } from "./pending-onboarding-sync-secure-store";

describe("pending onboarding sync web storage", () => {
	test("rejects plaintext persistence in production web builds", async () => {
		const localStorage = {
			getItem: jest.fn(() => null),
			setItem: jest.fn(),
			removeItem: jest.fn(),
		};
		const storage = createPendingOnboardingSyncStorage({
			platform: "web",
			isDevelopment: false,
			webStorage: localStorage,
		});

		await expect(storage.getItem("payload")).rejects.toThrow(
			"Production web onboarding recovery is unsupported",
		);
		await expect(storage.setItem("payload", "answers")).rejects.toThrow(
			"Production web onboarding recovery is unsupported",
		);
		await expect(storage.deleteItem("payload")).rejects.toThrow(
			"Production web onboarding recovery is unsupported",
		);
		expect(localStorage.setItem).not.toHaveBeenCalled();
	});
});
