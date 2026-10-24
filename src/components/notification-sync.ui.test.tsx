import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import { NotificationSync } from "./notification-sync";

const mockPush = jest.fn();
const mockOpen = jest.fn(
	async (_args: unknown) => "/learning-plans/plan/sessions/session",
);
const mockRecord = jest.fn(async () => undefined);
const mockClear = jest.fn(async () => undefined);
let mockAuthenticated = true;
let mockPathname = "/home";
let mockResponse: unknown = null;
let mockListener: ((response: unknown) => void) | undefined;
const mockUser = { clerkId: "user-1" };
const mockRouter = { push: mockPush };
const mockNotifications = {
	setNotificationHandler: jest.fn(),
	addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
	addNotificationResponseReceivedListener: jest.fn(
		(listener: (response: unknown) => void) => {
			mockListener = listener;
			return { remove: jest.fn() };
		},
	),
	getPresentedNotificationsAsync: jest.fn(async () => []),
	getLastNotificationResponse: () => mockResponse,
	clearLastNotificationResponseAsync: mockClear,
};

jest.mock("#convex/_generated/api", () => ({
	api: {
		notifications: {
			openNotification: "open",
			recordDeliveredNotification: "record",
			registerLocalNotificationPlan: "register",
			syncDueNotifications: "sync",
			getPreferences: "prefs",
		},
		dayEntries: { listByDayKeys: "entries" },
	},
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
	useQuery: () => undefined,
	useMutation: (ref: unknown) => (ref === "open" ? mockOpen : mockRecord),
}));
jest.mock("expo-router", () => ({
	useRootNavigationState: () => ({ key: "root" }),
	usePathname: () => mockPathname,
	useRouter: () => mockRouter,
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: mockUser,
		isSessionLoading: false,
		onboardingCompletionStatus: "none",
		pendingSessionTask: null,
	}),
}));
jest.mock("~/lib/notification-permissions", () => ({
	getNotificationsModule: () => mockNotifications,
}));

const response = (owner = "user-1") => ({
	actionIdentifier: "default",
	notification: {
		date: Date.now(),
		request: {
			identifier: "push-1",
			content: {
				data: {
					dayovaNotificationKey: "start:entry",
					dayovaNotificationRegistrationId: "registration",
					dayovaOwnerId: owner,
				},
			},
		},
	},
});

beforeEach(() => {
	jest.clearAllMocks();
	mockAuthenticated = true;
	mockPathname = "/home";
	mockResponse = null;
	mockListener = undefined;
});

test("opens a cold-start reminder once authentication resolves", async () => {
	mockResponse = response();
	mockAuthenticated = false;
	const screen = await render(<NotificationSync />);
	expect(mockOpen).not.toHaveBeenCalled();
	mockAuthenticated = true;
	await screen.rerender(<NotificationSync />);
	await waitFor(() =>
		expect(mockPush).toHaveBeenCalledWith(
			"/learning-plans/plan/sessions/session",
		),
	);
	expect(mockOpen).toHaveBeenCalledWith({ registrationId: "registration" });
	expect(mockClear).toHaveBeenCalledTimes(1);
	await screen.rerender(<NotificationSync />);
	expect(mockOpen).toHaveBeenCalledTimes(1);
});

test("opens warm responses but ignores reminders for another account", async () => {
	await render(<NotificationSync />);
	await act(async () => {
		mockListener?.(response("other"));
	});
	expect(mockOpen).not.toHaveBeenCalled();
	await act(async () => {
		mockListener?.(response());
	});
	expect(mockPush).toHaveBeenCalledWith(
		"/learning-plans/plan/sessions/session",
	);
});

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({ access: { canUseApp: true }, isAccessLoading: false }),
}));
test("waits for the auth navigation redirect before consuming the cold-start response", async () => {
	mockPathname = "/login";
	mockResponse = response();
	const screen = await render(<NotificationSync />);
	expect(mockOpen).not.toHaveBeenCalled();
	mockPathname = "/home";
	await screen.rerender(<NotificationSync />);
	await waitFor(() => expect(mockOpen).toHaveBeenCalledTimes(1));
});

test.each([
	"learning",
	"trial",
])("clears a %s response before navigating and deduplicates while clearing", async (kind) => {
	const notification = response();
	if (kind === "trial") {
		Object.assign(notification.notification.request.content, {
			data: { dayovaOwnerId: "user-1", dayovaTrialReminderKey: "trial" },
		});
	}
	mockResponse = notification;
	let finishClear: () => void = () => {};
	mockClear.mockImplementationOnce(
		() =>
			new Promise<undefined>((resolve) => {
				finishClear = () => {
					mockResponse = null;
					resolve(undefined);
				};
			}),
	);
	const screen = await render(<NotificationSync />);
	await waitFor(() => expect(mockClear).toHaveBeenCalledTimes(1));
	expect(mockPush).not.toHaveBeenCalled();
	await act(async () => {
		mockListener?.(notification);
	});
	expect(mockClear).toHaveBeenCalledTimes(1);
	await act(async () => {
		finishClear();
	});
	expect(mockPush).toHaveBeenCalledTimes(1);
	expect(mockPush).toHaveBeenCalledWith(
		kind === "trial"
			? "/subscription"
			: "/learning-plans/plan/sessions/session",
	);
	await screen.unmount();
	await render(<NotificationSync />);
	expect(mockPush).toHaveBeenCalledTimes(1);
});
