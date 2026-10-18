import { describe, expect, it, vi } from "vitest";
import {
	readAccountDeletionResponse,
	submitAccountDeletion,
} from "./account-deletion-request";

const setup = () => {
	const session = {
		startVerification: vi.fn().mockResolvedValue({
			status: "needs_first_factor",
			supportedFirstFactors: [{ strategy: "password" }],
		}),
		attemptFirstFactorVerification: vi
			.fn()
			.mockResolvedValue({ status: "complete" }),
		getToken: vi.fn().mockResolvedValue("fresh-token"),
	};
	const request = vi
		.fn()
		.mockResolvedValue({ status: "accepted", requestId: "request-1" });
	const logout = vi.fn().mockResolvedValue(undefined);
	return { session, request, logout };
};

describe("native account deletion", () => {
	it.each([
		[403, "Das aktuelle Passwort ist falsch."],
		[429, "Zu viele Versuche. Bitte versuche es später erneut."],
		[503, "Die Passwortprüfung ist vorübergehend nicht verfügbar."],
	])("preserves the server error for HTTP %s without signing out", async (status, error) => {
		const deps = setup();
		deps.request.mockImplementation(() =>
			readAccountDeletionResponse(Response.json({ error }, { status })),
		);
		await expect(submitAccountDeletion(deps, "password")).rejects.toThrow(
			error,
		);
		expect(deps.logout).not.toHaveBeenCalled();
	});
	it.each([
		"not JSON",
		"null",
		"{}",
		'{"error":42}',
		'{"error":"  "}',
	])("uses a safe fallback for an unusable error body: %s", async (body) => {
		await expect(
			readAccountDeletionResponse(new Response(body, { status: 503 })),
		).rejects.toThrow(
			"Die Kontolöschung konnte nicht bestätigt werden. Bitte versuche es erneut.",
		);
	});
	it("reads an accepted HTTP response before signing out", async () => {
		const deps = setup();
		deps.request.mockImplementation(() =>
			readAccountDeletionResponse(
				Response.json({ status: "accepted", requestId: "request-1" }),
			),
		);
		await submitAccountDeletion(deps, "password");
		expect(deps.logout).toHaveBeenCalledOnce();
	});
	it("reverifies and uses a fresh token before submitting and signing out", async () => {
		const deps = setup();
		await submitAccountDeletion(deps, "test-password");
		expect(deps.session.attemptFirstFactorVerification).toHaveBeenCalledWith({
			strategy: "password",
			password: "test-password",
		});
		expect(deps.session.getToken).toHaveBeenCalledWith({
			template: "convex",
			skipCache: true,
		});
		expect(deps.request).toHaveBeenCalledWith("fresh-token");
		expect(deps.logout).toHaveBeenCalledOnce();
		expect(deps.session.getToken.mock.invocationCallOrder[0]).toBeGreaterThan(
			deps.session.attemptFirstFactorVerification.mock.invocationCallOrder[0],
		);
		expect(deps.logout.mock.invocationCallOrder[0]).toBeGreaterThan(
			deps.request.mock.invocationCallOrder[0],
		);
	});
	it("never signs out when the server still requires verification", async () => {
		const deps = setup();
		deps.request.mockResolvedValue({
			clerk_error: { reason: "reverification-error" },
		});
		await expect(submitAccountDeletion(deps, "password")).rejects.toThrow();
		expect(deps.logout).not.toHaveBeenCalled();
	});
	it("does not submit after wrong password", async () => {
		const deps = setup();
		deps.session.attemptFirstFactorVerification.mockRejectedValue(
			new Error("invalid"),
		);
		await expect(submitAccountDeletion(deps, "wrong")).rejects.toThrow();
		expect(deps.request).not.toHaveBeenCalled();
		expect(deps.logout).not.toHaveBeenCalled();
	});
	it("does not submit without a fresh token", async () => {
		const deps = setup();
		deps.session.getToken.mockResolvedValue(null);
		await expect(submitAccountDeletion(deps, "password")).rejects.toThrow();
		expect(deps.request).not.toHaveBeenCalled();
	});
	it("rejects an empty password before any side effect", async () => {
		const deps = setup();
		await expect(submitAccountDeletion(deps, "")).rejects.toThrow();
		expect(deps.session.startVerification).not.toHaveBeenCalled();
	});
	it("preserves the session on a failed deletion request", async () => {
		const deps = setup();
		deps.request.mockRejectedValue(new Error("offline"));
		await expect(submitAccountDeletion(deps, "password")).rejects.toThrow();
		expect(deps.logout).not.toHaveBeenCalled();
	});
});
