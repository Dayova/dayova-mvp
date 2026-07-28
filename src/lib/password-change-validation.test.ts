import { describe, expect, test } from "vitest";
import {
	clearPasswordChangeErrors,
	validatePasswordChange,
} from "./password-change-validation";

describe("password change validation", () => {
	test("reports all dependent validation failures", () => {
		expect(
			validatePasswordChange({
				currentPassword: "same-password",
				newPassword: "same-password",
				confirmPassword: "different",
			}),
		).toEqual({
			newPassword:
				"Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.",
			confirmPassword: "Die neuen Passwörter stimmen nicht überein.",
		});
	});

	test("clears errors whose truth changes with the edited field", () => {
		const errors = {
			currentPassword: "current",
			newPassword: "new",
			confirmPassword: "confirm",
		};

		expect(clearPasswordChangeErrors(errors, "currentPassword")).toEqual({
			confirmPassword: "confirm",
		});
		expect(clearPasswordChangeErrors(errors, "newPassword")).toEqual({
			currentPassword: "current",
		});
	});
});
