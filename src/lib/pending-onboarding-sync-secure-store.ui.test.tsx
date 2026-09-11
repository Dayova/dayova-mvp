import { describe, expect, jest, test } from "@jest/globals";
import { createPendingOnboardingSyncStorage } from "./pending-onboarding-sync-secure-store";

describe("pending onboarding sync web storage", () => {
	test("round-trips development payloads through the namespaced fallback", async () => {
		const values = new Map<string, string>();
		const localStorage = {
			getItem: jest.fn((key: string) => values.get(key) ?? null),
			setItem: jest.fn((key: string, value: string) => values.set(key, value)),
			removeItem: jest.fn((key: string) => values.delete(key)),
		};
		const storage = createPendingOnboardingSyncStorage({
			platform: "web",
			isDevelopment: true,
			webStorage: localStorage,
		});

		await storage.setItem("payload", "answers");
		expect(localStorage.setItem).toHaveBeenCalledWith(
			"dayova.secure-fallback:payload",
			"answers",
		);
		await expect(storage.getItem("payload")).resolves.toBe("answers");
		await storage.deleteItem("payload");
		expect(localStorage.removeItem).toHaveBeenCalledWith(
			"dayova.secure-fallback:payload",
		);
		await expect(storage.getItem("payload")).resolves.toBeNull();
	});

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
