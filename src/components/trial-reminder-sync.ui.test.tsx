import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import type { AccessSnapshot } from "~/lib/access-policy";
import { TrialReminderSync } from "./trial-reminder-sync";

let mockAccess: AccessSnapshot | undefined;
let mockUser: { clerkId: string } | null;
let mockSystemNotificationsEnabled: boolean | undefined = true;

const mockScheduled: Array<{
	identifier: string;
	content: { data?: Record<string, string> };
}> = [];
const mockGetPermissionsAsync = jest.fn<() => Promise<{ granted: boolean }>>();
const mockCancelScheduledNotificationAsync = jest.fn(
	async (identifier: string) => {
		const index = mockScheduled.findIndex(
			(item) => item.identifier === identifier,
		);
		if (index >= 0) mockScheduled.splice(index, 1);
	},
);
const mockScheduleNotificationAsync = jest.fn(
	async (request: { content: { data: Record<string, string> } }) => {
		const identifier = `scheduled-${mockScheduled.length + 1}`;
		mockScheduled.push({
			identifier,
			content: { data: request.content.data },
		});
		return identifier;
	},
);

beforeEach(() => {
	jest.clearAllMocks();
	mockScheduled.splice(0);
	mockSystemNotificationsEnabled = true;
	mockAccess = undefined;
	mockUser = null;
});

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () =>
		mockSystemNotificationsEnabled === undefined
			? undefined
			: { systemNotificationsEnabled: mockSystemNotificationsEnabled },
}));

jest.mock("expo-notifications", () => ({
	AndroidImportance: { DEFAULT: 3 },
	IosAuthorizationStatus: { PROVISIONAL: 3 },
	SchedulableTriggerInputTypes: { DATE: "date" },
	cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
	getAllScheduledNotificationsAsync: jest.fn(async () => [...mockScheduled]),
	getPermissionsAsync: mockGetPermissionsAsync,
	scheduleNotificationAsync: mockScheduleNotificationAsync,
	setNotificationChannelAsync: jest.fn(async () => undefined),
}));

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => ({ access: mockAccess }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: mockUser }),
}));

const activeTrial = (): AccessSnapshot => ({
	canUseApp: true,
	state: "trial",
	reminderAt: Date.now() + 60_000,
	trialExpiresAt: Date.now() + 120_000,
});

describe("TrialReminderSync", () => {
	test("preserves an existing reminder while preferences are loading", async () => {
		mockScheduled.push({
			identifier: "existing-trial",
			content: { data: { dayovaTrialReminderKey: "trial-ending:old" } },
		});
		mockAccess = activeTrial();
		mockUser = { clerkId: "user-1" };
		mockSystemNotificationsEnabled = undefined;

		await render(<TrialReminderSync />);

		expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
		expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalled();
		expect(mockScheduled).toHaveLength(1);
	});

	test("clears the trial reminder when system notifications are disabled", async () => {
		mockScheduled.splice(0, mockScheduled.length, {
			identifier: "existing-trial",
			content: { data: { dayovaTrialReminderKey: "trial-ending:old" } },
		});
		mockAccess = activeTrial();
		mockUser = { clerkId: "user-1" };
		mockSystemNotificationsEnabled = false;
		mockGetPermissionsAsync.mockResolvedValue({ granted: true });

		await render(<TrialReminderSync />);

		await waitFor(() =>
			expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
				"existing-trial",
			),
		);
		expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
		expect(mockScheduled).toHaveLength(0);
	});

	test("a logout queued behind an older permission check wins the race", async () => {
		mockAccess = activeTrial();
		mockUser = { clerkId: "user-1" };
		let resolvePermissions: (value: { granted: boolean }) => void = () =>
			undefined;
		mockGetPermissionsAsync.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolvePermissions = resolve;
				}),
		);

		const screen = await render(<TrialReminderSync />);
		await waitFor(() => expect(mockGetPermissionsAsync).toHaveBeenCalled());

		mockAccess = undefined;
		mockUser = null;
		await screen.rerender(<TrialReminderSync />);
		await act(async () => {
			resolvePermissions({ granted: true });
		});

		await waitFor(() => expect(mockScheduled).toHaveLength(0));
		expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
		expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
			"scheduled-1",
		);
	});
});
