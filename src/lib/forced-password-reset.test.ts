import { describe, expect, test, vi } from "vitest";
import {
	completeForcedPasswordReset,
	type ForcedPasswordResetUser,
} from "./forced-password-reset";

describe("completeForcedPasswordReset", () => {
	test("sets the required new password and revokes every other session", async () => {
		const updatePassword = vi.fn(async () => undefined);
		const user: ForcedPasswordResetUser = { updatePassword };

		await completeForcedPasswordReset(user, "neues-passwort");

		expect(updatePassword).toHaveBeenCalledWith({
			newPassword: "neues-passwort",
			signOutOfOtherSessions: true,
		});
	});
});
