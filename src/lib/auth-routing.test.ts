import { describe, expect, test } from "vitest";
import {
	getAuthNavigationTarget,
	isOnboardingSettled,
	ONBOARDING_CREATION_PATH,
	PASSWORD_RESET_SUCCESS_PATH,
	SESSION_TASK_RESET_PASSWORD_PATH,
} from "./auth-routing";

describe("isOnboardingSettled", () => {
	test.each([
		"none",
		"ready_for_trial",
	] as const)("accepts %s as settled", (status) => {
		expect(isOnboardingSettled(status)).toBe(true);
	});

	test.each([
		"loading",
		"pending",
		"recovery_required",
		"storage_error",
	] as const)("keeps %s gated", (status) => {
		expect(isOnboardingSettled(status)).toBe(false);
	});
});

describe("getAuthNavigationTarget", () => {
	test("waits for Clerk before making a navigation decision", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: true,
				pathname: "/home",
				pendingSessionTask: null,
			}),
		).toBeNull();
	});

	test("keeps a pending reset task out of protected app routes", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: false,
				pathname: "/home",
				pendingSessionTask: "reset-password",
			}),
		).toBe(SESSION_TASK_RESET_PASSWORD_PATH);
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: false,
				pathname: SESSION_TASK_RESET_PASSWORD_PATH,
				pendingSessionTask: "reset-password",
			}),
		).toBeNull();
	});

	test("routes a completed signed-in onboarding handoff through creation", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				pathname: "/login",
				pendingSessionTask: "reset-password",
			}),
		).toBe(SESSION_TASK_RESET_PASSWORD_PATH);
	});

	test("enters the app after the reset task completes", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				pathname: SESSION_TASK_RESET_PASSWORD_PATH,
				pendingSessionTask: null,
			}),
		).toBe("/home");
	});

	test("keeps the password-reset success message reachable before and after Clerk settles", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: true,
				pathname: PASSWORD_RESET_SUCCESS_PATH,
				pendingSessionTask: null,
			}),
		).toBeNull();
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: false,
				pathname: PASSWORD_RESET_SUCCESS_PATH,
				pendingSessionTask: null,
			}),
		).toBeNull();
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				pathname: PASSWORD_RESET_SUCCESS_PATH,
				pendingSessionTask: null,
			}),
		).toBeNull();
	});

	test("restores a persisted session and reacts to remote revocation", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				pathname: "/login",
				pendingSessionTask: null,
			}),
		).toBe("/home");
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: false,
				pathname: "/home",
				pendingSessionTask: null,
			}),
		).toBe("/");
	});
	test("waits for the durable onboarding outbox and resumes it before app access", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				onboardingCompletionStatus: "loading",
				pathname: "/home",
				pendingSessionTask: null,
			}),
		).toBeNull();
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				onboardingCompletionStatus: "pending",
				pathname: "/home",
				pendingSessionTask: null,
			}),
		).toBe(ONBOARDING_CREATION_PATH);
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				onboardingCompletionStatus: "ready_for_trial",
				pathname: ONBOARDING_CREATION_PATH,
				pendingSessionTask: null,
			}),
		).toBeNull();
	});

	test("keeps native onboarding step routes public during registration", () => {
		expect(
			getAuthNavigationTarget({
				hasUser: false,
				isSessionLoading: false,
				pathname: "/onboarding/studyTime",
				pendingSessionTask: null,
			}),
		).toBeNull();
		expect(
			getAuthNavigationTarget({
				hasUser: true,
				isSessionLoading: false,
				onboardingCompletionStatus: "ready_for_trial",
				pathname: "/home",
				pendingSessionTask: null,
			}),
		).toBe(ONBOARDING_CREATION_PATH);
	});
});
