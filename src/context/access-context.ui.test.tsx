import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, render, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Platform, Text } from "react-native";
import { AccessProvider, useAccess } from "./AccessContext";

const mockUseQuery = jest.fn<(query: unknown, args: unknown) => unknown>(
	() => undefined,
);
const mockSession = {
	isConvexUserSynced: false,
	isSessionLoading: false,
	onboardingCompletionStatus: "none",
	user: { clerkId: "user_123" },
};

jest.mock("convex/react", () => ({
	useAction: () => jest.fn(),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => jest.fn(),
	useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
}));

jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

describe("AccessProvider", () => {
	beforeEach(() => {
		mockUseQuery.mockClear();
		jest.mocked(SecureStore.getItemAsync).mockClear();
		jest.mocked(SecureStore.setItemAsync).mockClear();
		mockSession.isConvexUserSynced = false;
		mockSession.onboardingCompletionStatus = "none";
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const AccessProbe = () => {
		const { access, isAccessLoading } = useAccess();
		return (
			<Text>{isAccessLoading ? "loading" : (access?.state ?? "idle")}</Text>
		);
	};

	test("waits for the authenticated user to be synced before querying access", async () => {
		const screen = await render(
			<AccessProvider>
				<Text>App</Text>
			</AccessProvider>,
		);

		try {
			expect(mockUseQuery.mock.calls[0]?.[1]).toBe("skip");
		} finally {
			screen.unmount();
		}
	});

	test("queries access after the authenticated user has been synced", async () => {
		mockSession.isConvexUserSynced = true;
		const screen = await render(
			<AccessProvider>
				<Text>App</Text>
			</AccessProvider>,
		);

		try {
			expect(mockUseQuery.mock.calls[0]?.[1]).toEqual({
				now: expect.any(Number),
			});
		} finally {
			screen.unmount();
		}
	});

	test("uses a SecureStore-compatible cache key", async () => {
		const screen = await render(
			<AccessProvider>
				<Text>App</Text>
			</AccessProvider>,
		);

		try {
			await waitFor(() =>
				expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
					"dayova-access.user_123",
				),
			);
		} finally {
			screen.unmount();
		}
	});

	test("starts the access timeout only after onboarding allows the query", async () => {
		jest.useFakeTimers();
		mockSession.isConvexUserSynced = true;
		mockSession.onboardingCompletionStatus = "pending";
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);

		try {
			await act(async () => {
				jest.advanceTimersByTime(2_000);
			});
			mockSession.onboardingCompletionStatus = "ready_for_trial";
			await screen.rerender(
				<AccessProvider>
					<AccessProbe />
				</AccessProvider>,
			);

			expect(screen.getByText("loading")).toBeOnTheScreen();
		} finally {
			screen.unmount();
		}
	});

	test("migrates the legacy web cache key to the SecureStore-compatible prefix", async () => {
		const originalPlatform = Platform.OS;
		const values = new Map<string, string>([
			[
				"dayova-access:user_123",
				JSON.stringify({
					access: { canUseApp: true, state: "paid" },
					verifiedAt: Date.now(),
				}),
			],
		]);
		const localStorage = {
			getItem: jest.fn((key: string) => values.get(key) ?? null),
			setItem: jest.fn((key: string, value: string) => values.set(key, value)),
			removeItem: jest.fn((key: string) => values.delete(key)),
		};
		const originalStorage = Object.getOwnPropertyDescriptor(
			globalThis,
			"localStorage",
		);
		Object.defineProperty(Platform, "OS", {
			configurable: true,
			value: "web",
		});
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: localStorage,
		});
		const screen = await render(
			<AccessProvider>
				<Text>App</Text>
			</AccessProvider>,
		);

		try {
			await waitFor(() =>
				expect(localStorage.setItem).toHaveBeenCalledWith(
					"dayova-access.user_123",
					expect.any(String),
				),
			);
			expect(localStorage.removeItem).toHaveBeenCalledWith(
				"dayova-access:user_123",
			);
		} finally {
			screen.unmount();
			Object.defineProperty(Platform, "OS", {
				configurable: true,
				value: originalPlatform,
			});
			if (originalStorage) {
				Object.defineProperty(globalThis, "localStorage", originalStorage);
			} else {
				Reflect.deleteProperty(globalThis, "localStorage");
			}
		}
	});
});
