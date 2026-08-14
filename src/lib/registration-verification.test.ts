import { describe, expect, test, vi } from "vitest";
import { finalizeVerifiedRegistration } from "./registration-verification";

describe("finalizeVerifiedRegistration", () => {
	test("activates the completed Clerk session even when durable binding fails", async () => {
		const events: string[] = [];
		const bindingError = new Error("secure storage unavailable");
		const onBindingFailure = vi.fn(() => {
			events.push("failure-recorded");
		});

		await finalizeVerifiedRegistration({
			identity: {
				registrationAttemptId: "signup_123",
				clerkUserId: "user_123",
				accountFingerprint: "fingerprint",
				sessionId: "session_123",
			},
			bindToUser: async () => {
				events.push("bind");
				throw bindingError;
			},
			onBindingFailure,
			activateSession: async () => {
				events.push("activate");
			},
		});

		expect(onBindingFailure).toHaveBeenCalledWith(
			bindingError,
			expect.objectContaining({ registrationAttemptId: "signup_123" }),
		);
		expect(events).toEqual(["bind", "failure-recorded", "activate"]);
	});
});
