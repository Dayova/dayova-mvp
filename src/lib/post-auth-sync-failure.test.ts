import { describe, expect, test } from "vitest";
import { clearOwnedPostAuthSyncFailure } from "./post-auth-sync-failure";

describe("clearOwnedPostAuthSyncFailure", () => {
	test("clears only the failure boundary owned by the successful retry", () => {
		expect(clearOwnedPostAuthSyncFailure("profile", "profile")).toBeNull();
		expect(clearOwnedPostAuthSyncFailure("answers", "answers")).toBeNull();
		expect(clearOwnedPostAuthSyncFailure("restore", "profile")).toBe("restore");
		expect(clearOwnedPostAuthSyncFailure("completion", "answers")).toBe(
			"completion",
		);
	});
});
