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

	test("activates the completed session even when failure recording throws", async () => {
		const events: string[] = [];
		const failureError = new Error("failure boundary unavailable");

		await expect(
			finalizeVerifiedRegistration({
				identity: {
					registrationAttemptId: "signup_123",
					clerkUserId: "user_123",
					accountFingerprint: "fingerprint",
					sessionId: "session_123",
				},
				bindToUser: async () => {
					throw new Error("secure storage unavailable");
				},
				onBindingFailure: () => {
					events.push("failure-recording");
					throw failureError;
				},
				activateSession: async () => {
					events.push("activate");
				},
			}),
		).rejects.toBe(failureError);
		expect(events).toEqual(["failure-recording", "activate"]);
	});
});
