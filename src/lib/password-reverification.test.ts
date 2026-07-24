import { describe, expect, test, vi } from "vitest";
import {
	reverifyPasswordFactor,
	type PasswordReverificationSession,
} from "./password-reverification";

describe("reverifyPasswordFactor", () => {
	test("records the current password as a recent Clerk first factor", async () => {
		const startVerification = vi.fn(async () => ({
			status: "needs_first_factor" as const,
			supportedFirstFactors: [{ strategy: "password" }],
		}));
		const attemptFirstFactorVerification = vi.fn(async () => ({
			status: "complete" as const,
		}));
		const session: PasswordReverificationSession = {
			attemptFirstFactorVerification,
			startVerification,
		};

		await reverifyPasswordFactor(session, "aktuelles-passwort");

		expect(startVerification).toHaveBeenCalledWith({ level: "first_factor" });
		expect(attemptFirstFactorVerification).toHaveBeenCalledWith({
			password: "aktuelles-passwort",
			strategy: "password",
		});
	});

	test("fails safely when the account has no password factor", async () => {
		const session: PasswordReverificationSession = {
			attemptFirstFactorVerification: vi.fn(),
			startVerification: vi.fn(async () => ({
				status: "needs_first_factor",
				supportedFirstFactors: [{ strategy: "email_code" }],
			})),
		};

		await expect(
			reverifyPasswordFactor(session, "aktuelles-passwort"),
		).rejects.toThrow("erneut anmelden");
	});
});
