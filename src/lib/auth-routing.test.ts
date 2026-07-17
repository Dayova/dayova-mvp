import { describe, expect, test } from "vitest";
import {
	getAuthNavigationTarget,
	SESSION_TASK_RESET_PASSWORD_PATH,
} from "./auth-routing";

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
});
