import { describe, expect, test, vi } from "vitest";
import {
	clearOwnedPostAuthSyncFailure,
	retryPostAuthSyncFailure,
} from "./post-auth-sync-failure";

describe("clearOwnedPostAuthSyncFailure", () => {
	test("clears only the failure boundary owned by the successful retry", () => {
		expect(clearOwnedPostAuthSyncFailure("profile", "profile")).toBeNull();
		expect(clearOwnedPostAuthSyncFailure("answers", "answers")).toBeNull();
		expect(clearOwnedPostAuthSyncFailure("restore", "profile")).toBe("restore");
		expect(clearOwnedPostAuthSyncFailure("completion", "answers")).toBe(
			"completion",
		);
	});

	test("retries the completion acknowledgement at its owned boundary", () => {
		const handlers = {
			profile: vi.fn(),
			answers: vi.fn(),
			completion: vi.fn(),
			restore: vi.fn(),
		};

		retryPostAuthSyncFailure("completion", handlers);

		expect(handlers.completion).toHaveBeenCalledTimes(1);
		expect(handlers.profile).not.toHaveBeenCalled();
		expect(handlers.answers).not.toHaveBeenCalled();
		expect(handlers.restore).not.toHaveBeenCalled();
	});
});
