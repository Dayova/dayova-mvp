import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { AppState, type AppStateStatus } from "react-native";
import type { api } from "#convex/_generated/api";
import type { AccessSnapshot } from "~/lib/access-contract";
import type { NotificationPlanningPreferences } from "~/lib/notification-planner";
import { NotificationSync } from "./notification-sync";

// Auth/access contexts are the already-verified consumer boundary. The real
// learning-query hook, planner and scheduler run against simulated native APIs.
let mockAccess: AccessSnapshot | undefined;
let mockConvexAuthenticated = true;
let mockUser = { clerkId: "notification-owner" };
let mockNativeSequence = 0;
const mockAppStateListeners = new Set<(state: AppStateStatus) => void>();
const mockRouter = { push: jest.fn() };
const mockDiagnosticError = jest.fn();
const mockPreferences: NotificationPlanningPreferences = {
	systemNotificationsEnabled: true,
	dailyBriefingEnabled: true,
	dailyBriefingTime: "07:30",
	beforeExamEnabled: false,
	beforeLearningTimeEnabled: false,
	beforeHomeworkWorkEnabled: false,
	beforeHomeworkDueEnabled: false,
	reminderOffsetMinutes: 15,
	forgottenEventEnabled: false,
};
const mockEntries = {
	"2026-11-19": [
		{
			title: "Mathematik",
			time: "10:00",
			kind: "Unterricht",
			durationMinutes: 45,
		},
	],
};
type RegistrationArgs = FunctionArgs<
	typeof api.notifications.registerLocalNotificationPlan
>;
type Registrations = FunctionReturnType<
	typeof api.notifications.registerLocalNotificationPlan
>;
const mockRegister =
	jest.fn<(args: RegistrationArgs) => Promise<Registrations>>();
const mockSyncDue = jest.fn(async () => null);
const mockRecordDelivered = jest.fn(async () => null);
type NativeRequest = {
	identifier: string;
	content: { title?: string; data?: Record<string, string> };
};
type ScheduleRequest = {
	content: { title: string; body: string; data: Record<string, string> };
};
const mockScheduled = new Map<string, NativeRequest>();
const mockNotifications = {
	AndroidImportance: { DEFAULT: 3 },
	IosAuthorizationStatus: { PROVISIONAL: 3 },
	SchedulableTriggerInputTypes: { DATE: "date" },
	setNotificationChannelAsync: jest.fn(async () => null),
	setNotificationHandler: jest.fn(),
	addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
	addNotificationResponseReceivedListener: jest.fn(() => ({
		remove: jest.fn(),
	})),
	getPresentedNotificationsAsync: jest.fn(async () => []),
	getLastNotificationResponse: jest.fn(() => null),
	getPermissionsAsync: jest.fn(async () => ({ granted: true })),
	getAllScheduledNotificationsAsync: jest.fn(async () => [
		...mockScheduled.values(),
	]),
	cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
		mockScheduled.delete(id);
	}),
	scheduleNotificationAsync:
		jest.fn<(request: ScheduleRequest) => Promise<string>>(),
};
jest.mock("~/lib/diagnostics", () => ({
	logDiagnosticError: (...args: unknown[]) => mockDiagnosticError(...args),
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: mockUser, isSessionLoading: false }),
}));
jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({ access: mockAccess }),
}));
jest.mock("~/lib/notification-permissions", () => ({
	...jest.requireActual<typeof import("~/lib/notification-permissions")>(
		"~/lib/notification-permissions",
	),
	getNotificationsModule: () => mockNotifications,
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mockConvexAuthenticated }),
	useQuery: (ref: unknown, args: unknown) => {
		if (args === "skip") return undefined;
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(ref as Parameters<typeof getFunctionName>[0]) ===
			"notifications:getPreferences"
			? mockPreferences
			: mockEntries;
	},
	useMutation: (ref: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		switch (getFunctionName(ref as Parameters<typeof getFunctionName>[0])) {
			case "notifications:registerLocalNotificationPlan":
				return mockRegister;
			case "notifications:syncDueNotifications":
				return mockSyncDue;
			default:
				return mockRecordDelivered;
		}
	},
}));
const trial = (): AccessSnapshot => ({
	state: "trial",
	canUseApp: true,
	trialExpiresAt: new Date(2026, 10, 20).getTime(),
});
const reminders = () =>
	[...mockScheduled.values()].filter(
		(request) =>
			typeof request.content.data?.dayovaNotificationKey === "string",
	);
const register: (args: RegistrationArgs) => Promise<Registrations> = async ({
	notifications,
}) =>
	notifications.map((n, index) => ({
		eventKey: n.eventKey,
		scheduledFor: Date.parse(n.scheduledFor),
		registrationId: ("registration-" +
			index) as Registrations[number]["registrationId"],
	}));
beforeEach(() => {
	jest.useFakeTimers();
	mockAppStateListeners.clear();
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_type, listener) => {
			mockAppStateListeners.add(listener);
			return {
				remove: () => {
					mockAppStateListeners.delete(listener);
				},
			};
		});
	jest.setSystemTime(new Date(2026, 10, 19, 7));
	mockUser = { clerkId: "notification-owner" };
	mockNativeSequence = 0;
	mockConvexAuthenticated = true;
	mockAccess = trial();
	mockScheduled.clear();
	mockDiagnosticError.mockClear();
	mockNotifications.cancelScheduledNotificationAsync
		.mockReset()
		.mockImplementation(async (id) => {
			mockScheduled.delete(id);
		});
	mockScheduled.set("unrelated", {
		identifier: "unrelated",
		content: { title: "Unrelated notification" },
	});
	mockRegister.mockReset().mockImplementation(register);
	mockNotifications.scheduleNotificationAsync
		.mockReset()
		.mockImplementation(async (request) => {
			const identifier = `scheduled-${++mockNativeSequence}`;
			mockScheduled.set(identifier, { identifier, content: request.content });
			return identifier;
		});
});
afterEach(() => {
	jest.restoreAllMocks();
	jest.useRealTimers();
});

test("confirmed access denial removes existing Dayova reminders while preserving unrelated notifications", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	mockAccess = { state: "expired", canUseApp: false };
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(0));
	expect(mockScheduled.has("unrelated")).toBe(true);
});

test("unknown access during offline verification preserves the existing reminder plan", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const previous = [...mockScheduled.values()];
	mockAccess = undefined;
	await screen.rerender(<NotificationSync />);
	expect([...mockScheduled.values()]).toEqual(previous);
});

test("renewed access rebuilds the same plan after confirmed denial cleared it", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	mockAccess = { state: "expired", canUseApp: false };
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(0));
	mockAccess = trial();
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
});

test("a registration response arriving after denial cannot recreate reminders", async () => {
	let complete!: (value: Registrations) => void;
	const pending = new Promise<Registrations>((resolve) => {
		complete = resolve;
	});
	mockRegister.mockImplementationOnce(() => pending);
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(mockRegister).toHaveBeenCalled());
	mockAccess = { state: "expired", canUseApp: false };
	await screen.rerender(<NotificationSync />);
	const args = mockRegister.mock.calls[0][0];
	await act(async () => complete(await register(args)));
	expect(reminders()).toHaveLength(0);
});

test("denial clears an OS scheduling operation that was already in flight", async () => {
	let complete!: () => void;
	const pending = new Promise<string>((resolve) => {
		complete = () => resolve("late-native-reminder");
	});
	mockNotifications.scheduleNotificationAsync.mockImplementationOnce(
		async (request) => {
			const identifier = await pending;
			mockScheduled.set(identifier, { identifier, content: request.content });
			return identifier;
		},
	);
	const screen = await render(<NotificationSync />);
	await waitFor(() =>
		expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled(),
	);
	mockAccess = { state: "expired", canUseApp: false };
	await screen.rerender(<NotificationSync />);
	await act(async () => {
		complete();
		await pending;
	});
	await waitFor(() => expect(reminders()).toHaveLength(0));
});

test("verification interrupted during registration can rebuild an identical plan when access returns", async () => {
	let complete!: (value: Registrations) => void;
	mockRegister.mockImplementationOnce(
		() =>
			new Promise<Registrations>((resolve) => {
				complete = resolve;
			}),
	);
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(mockRegister).toHaveBeenCalled());
	mockAccess = undefined;
	await screen.rerender(<NotificationSync />);
	await act(async () =>
		complete(await register(mockRegister.mock.calls[0][0])),
	);
	expect(reminders()).toHaveLength(0);
	mockAccess = trial();
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
});

test("a native cancellation failure is reported and does not block a later confirmed-denial cleanup", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const failure = new Error("Native cancellation failed");
	mockNotifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(
		failure,
	);
	mockAccess = { state: "expired", canUseApp: false };
	await screen.rerender(<NotificationSync />);
	await waitFor(() =>
		expect(mockDiagnosticError).toHaveBeenCalledWith(
			expect.any(String),
			failure,
			expect.objectContaining({ level: "warn" }),
		),
	);
	expect(reminders()).toHaveLength(1);
	mockAccess = undefined;
	await screen.rerender(<NotificationSync />);
	mockAccess = { state: "expired", canUseApp: false };
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(0));
});

test("an unchanged completed plan keeps its native reminders across equivalent account-context updates", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const completed = reminders();
	mockUser = { ...mockUser };
	await screen.rerender(<NotificationSync />);
	expect(reminders()).toEqual(completed);
});

test("a rejected initial registration is reported and an unchanged plan can retry after a context update", async () => {
	const failure = new Error("Registration unavailable");
	mockRegister.mockRejectedValueOnce(failure);
	const screen = await render(<NotificationSync />);
	await waitFor(() =>
		expect(mockDiagnosticError).toHaveBeenCalledWith(
			expect.any(String),
			failure,
			expect.objectContaining({ level: "warn" }),
		),
	);
	expect(reminders()).toHaveLength(0);
	mockUser = { ...mockUser };
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
});

const resume = async () => {
	if (mockAppStateListeners.size === 0)
		throw new Error("NotificationSync has no active lifecycle listener");
	await act(async () => {
		for (const listener of mockAppStateListeners) listener("inactive");
		for (const listener of mockAppStateListeners) listener("active");
	});
};

test("failed resume replacement can recover on an equivalent account-context update", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const failure = new Error("Native resume replacement failed");
	mockNotifications.scheduleNotificationAsync.mockRejectedValueOnce(failure);
	await resume();
	await waitFor(() =>
		expect(mockDiagnosticError).toHaveBeenCalledWith(
			expect.any(String),
			failure,
			expect.objectContaining({ level: "warn" }),
		),
	);
	expect(reminders()).toHaveLength(0);
	mockUser = { ...mockUser };
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
});

test("a successful resume after initial rejection keeps the now-complete plan deduplicated", async () => {
	const failure = new Error("Initial registration failed");
	mockRegister.mockRejectedValueOnce(failure);
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(mockDiagnosticError).toHaveBeenCalled());
	expect(reminders()).toHaveLength(0);
	await resume();
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const completed = reminders();
	mockUser = { ...mockUser };
	await screen.rerender(<NotificationSync />);
	expect(reminders()).toEqual(completed);
});

test("an older overlapping resume cannot overwrite reminders or complete a newer failed attempt", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const original = reminders();
	let complete!: (value: Registrations) => void;
	mockRegister.mockImplementationOnce(
		() =>
			new Promise<Registrations>((resolve) => {
				complete = resolve;
			}),
	);
	await resume();
	await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
	const olderArgs = mockRegister.mock.calls[1][0];
	const failure = new Error("Latest registration failed");
	mockRegister.mockRejectedValueOnce(failure);
	await resume();
	await waitFor(() =>
		expect(mockDiagnosticError).toHaveBeenCalledWith(
			expect.any(String),
			failure,
			expect.objectContaining({ level: "warn" }),
		),
	);
	await act(async () => complete(await register(olderArgs)));
	expect(reminders()).toEqual(original);
	mockUser = { ...mockUser };
	await screen.rerender(<NotificationSync />);
	await waitFor(() => {
		expect(reminders()).toHaveLength(1);
		expect(reminders()).not.toEqual(original);
	});
});

test("restored Convex eligibility reconciles native state while unknown access preserves the previous plan", async () => {
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
	const previous = reminders();
	mockConvexAuthenticated = false;
	mockAccess = undefined;
	await screen.rerender(<NotificationSync />);
	expect(reminders()).toEqual(previous);
	// Simulate the native scheduler no longer retaining the prior request while
	// this consumer cannot subscribe. Restoration must reconcile real OS state.
	for (const request of previous) mockScheduled.delete(request.identifier);
	mockConvexAuthenticated = true;
	mockAccess = trial();
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(reminders()).toHaveLength(1));
});
