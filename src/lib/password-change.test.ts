import { describe, expect, test, vi } from "vitest";
import { changePassword, type PasswordChangeUser } from "./password-change";

describe("changePassword", () => {
	test("reverifies with the current password and revokes other sessions", async () => {
		const updatePassword = vi.fn(async () => undefined);
		const user: PasswordChangeUser = { updatePassword };

		await changePassword(user, {
			currentPassword: "altes-passwort",
			newPassword: "neues-passwort",
		});

		expect(updatePassword).toHaveBeenCalledWith({
			currentPassword: "altes-passwort",
			newPassword: "neues-passwort",
			signOutOfOtherSessions: true,
		});
	});

	test("propagates Clerk failures to the auth error mapper", async () => {
		const clerkError = new Error("current password is incorrect");
		const user: PasswordChangeUser = {
			updatePassword: vi.fn(async () => {
				throw clerkError;
			}),
		};

		await expect(
			changePassword(user, {
				currentPassword: "falsch",
				newPassword: "neues-passwort",
			}),
		).rejects.toBe(clerkError);
	});
});
