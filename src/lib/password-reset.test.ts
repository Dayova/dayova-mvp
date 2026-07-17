import { describe, expect, test, vi } from "vitest";
import {
	completePasswordReset,
	resendPasswordResetCode,
	startPasswordReset,
	verifyPasswordResetCode,
	verifyPasswordResetSecondFactor,
	type PasswordResetSignIn,
} from "./password-reset";

function createSignInMock() {
	let status = "needs_identifier";
	const reset = vi.fn(async () => ({ error: null }));
	const create = vi.fn(async () => {
		status = "needs_first_factor";
		return { error: null as unknown | null };
	});
	const sendResetCode = vi.fn(async () => ({ error: null }));
	const verifyResetCode = vi.fn(async () => {
		status = "needs_new_password";
		return { error: null };
	});
	const submitPassword = vi.fn(async () => {
		status = "complete";
		return { error: null };
	});
	const sendSecondFactorCode = vi.fn(async () => ({ error: null }));
	const verifySecondFactorCode = vi.fn(async () => {
		status = "complete";
		return { error: null };
	});
	const finalize = vi.fn(async () => ({ error: null }));

	const signIn: PasswordResetSignIn = {
		get status() {
			return status;
		},
		reset,
		create,
		resetPasswordEmailCode: {
			sendCode: sendResetCode,
			verifyCode: verifyResetCode,
			submitPassword,
		},
		mfa: {
			sendEmailCode: sendSecondFactorCode,
			verifyEmailCode: verifySecondFactorCode,
		},
		finalize,
	};

	return {
		signIn,
		reset,
		create,
		sendResetCode,
		verifyResetCode,
		submitPassword,
		sendSecondFactorCode,
		verifySecondFactorCode,
		finalize,
		setStatus(nextStatus: string) {
			status = nextStatus;
		},
	};
}

describe("password reset flow", () => {
	test("starts a fresh reset attempt and sends a code to the normalized email", async () => {
		const mock = createSignInMock();

		await expect(
			startPasswordReset(mock.signIn, "  LERNER@EXAMPLE.DE "),
		).resolves.toEqual({ status: "code_sent" });

		expect(mock.reset).toHaveBeenCalledOnce();
		expect(mock.create).toHaveBeenCalledWith({
			identifier: "lerner@example.de",
		});
		expect(mock.sendResetCode).toHaveBeenCalledOnce();
		expect(mock.reset.mock.invocationCallOrder[0]).toBeLessThan(
			mock.create.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mock.create.mock.invocationCallOrder[0]).toBeLessThan(
			mock.sendResetCode.mock.invocationCallOrder[0] ?? 0,
		);
	});

	test("does not reveal whether an unknown account exists", async () => {
		const mock = createSignInMock();
		mock.create.mockResolvedValueOnce({
			error: {
				errors: [{ code: "form_identifier_not_found" }],
			},
		});

		await expect(
			startPasswordReset(mock.signIn, "unknown@example.de"),
		).resolves.toEqual({ status: "delivery_not_confirmed" });
		expect(mock.sendResetCode).not.toHaveBeenCalled();
	});

	test("stops when Clerk rejects creation of the reset attempt", async () => {
		const mock = createSignInMock();
		const clerkError = new Error("account unavailable");
		mock.create.mockResolvedValueOnce({ error: clerkError });

		await expect(
			startPasswordReset(mock.signIn, "lerner@example.de"),
		).rejects.toBe(clerkError);
		expect(mock.sendResetCode).not.toHaveBeenCalled();
	});

	test("verifies the reset code before accepting a new password", async () => {
		const mock = createSignInMock();

		await verifyPasswordResetCode(mock.signIn, " 123456 ");

		expect(mock.verifyResetCode).toHaveBeenCalledWith({ code: "123456" });
		expect(mock.signIn.status).toBe("needs_new_password");
	});

	test("revokes other sessions and activates the recovered session", async () => {
		const mock = createSignInMock();

		await expect(
			completePasswordReset(mock.signIn, "sicheres-passwort"),
		).resolves.toEqual({ status: "complete" });

		expect(mock.submitPassword).toHaveBeenCalledWith({
			password: "sicheres-passwort",
			signOutOfOtherSessions: true,
		});
		expect(mock.finalize).toHaveBeenCalledOnce();
	});

	test("handles a required email second factor before finalizing", async () => {
		const mock = createSignInMock();
		mock.submitPassword.mockImplementationOnce(async () => {
			mock.setStatus("needs_second_factor");
			return { error: null };
		});

		await expect(
			completePasswordReset(mock.signIn, "sicheres-passwort"),
		).resolves.toEqual({ status: "needs_second_factor" });
		expect(mock.sendSecondFactorCode).toHaveBeenCalledOnce();
		expect(mock.finalize).not.toHaveBeenCalled();

		await verifyPasswordResetSecondFactor(mock.signIn, " 654321 ");

		expect(mock.verifySecondFactorCode).toHaveBeenCalledWith({
			code: "654321",
		});
		expect(mock.finalize).toHaveBeenCalledOnce();
	});

	test("resends the code for the active recovery stage", async () => {
		const mock = createSignInMock();

		await resendPasswordResetCode(mock.signIn, "reset_code", true);
		await resendPasswordResetCode(mock.signIn, "second_factor", true);

		expect(mock.sendResetCode).toHaveBeenCalledOnce();
		expect(mock.sendSecondFactorCode).toHaveBeenCalledOnce();
	});

	test("treats resend for an unknown account as a successful no-op", async () => {
		const mock = createSignInMock();

		await expect(
			resendPasswordResetCode(mock.signIn, "reset_code", false),
		).resolves.toBeUndefined();
		expect(mock.sendResetCode).not.toHaveBeenCalled();
	});
});
