import { describe, expect, test, vi } from "vitest";
import {
	finalizeCompletedRegistration,
	finalizeVerifiedRegistration,
	IncompleteRegistrationIdentityError,
} from "./registration-verification";

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

	test("activates the completed session when Clerk identity fields are missing", async () => {
		const events: string[] = [];
		const onIdentityFailure = vi.fn(() => {
			events.push("identity-failure");
		});

		await finalizeCompletedRegistration({
			candidate: {
				registrationAttemptId: "signup_123",
				clerkUserId: null,
				emailAddress: "learner@example.com",
				sessionId: "session_123",
			},
			getAccountFingerprint: async () => "fingerprint",
			bindToUser: async () => {
				events.push("bind");
			},
			onBindingFailure: vi.fn(),
			onIdentityFailure,
			activateSession: async () => {
				events.push("activate");
			},
		});

		expect(onIdentityFailure).toHaveBeenCalledWith(
			expect.any(IncompleteRegistrationIdentityError),
			expect.objectContaining({ sessionId: "session_123" }),
		);
		expect(events).toEqual(["identity-failure", "activate"]);
	});

	test("activates the completed session when fingerprint resolution fails", async () => {
		const events: string[] = [];
		const fingerprintError = new Error("fingerprint unavailable");

		await finalizeCompletedRegistration({
			candidate: {
				registrationAttemptId: "signup_123",
				clerkUserId: "user_123",
				emailAddress: "learner@example.com",
				sessionId: "session_123",
			},
			getAccountFingerprint: async () => {
				throw fingerprintError;
			},
			bindToUser: async () => {
				events.push("bind");
			},
			onBindingFailure: vi.fn(),
			onIdentityFailure: (error) => {
				expect(error).toBe(fingerprintError);
				events.push("identity-failure");
			},
			activateSession: async () => {
				events.push("activate");
			},
		});

		expect(events).toEqual(["identity-failure", "activate"]);
	});
});
