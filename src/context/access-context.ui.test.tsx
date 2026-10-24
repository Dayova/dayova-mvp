import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { Platform, Text } from "react-native";
import { AccessProvider, useAccess } from "./AccessContext";

const mockUseQuery = jest.fn<(query: unknown, args: unknown) => unknown>(
	() => undefined,
);
const mockActivateTrial = jest.fn();
const mockSyncPaidAccess = jest.fn();
const mockSession = {
	isConvexUserSynced: false,
	isSessionLoading: false,
	onboardingCompletionStatus: "none",
	user: { clerkId: "user_123" },
};

jest.mock("convex/react", () => ({
	useAction: () => mockSyncPaidAccess,
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => mockActivateTrial,
	useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
	useQueries: (queries: Record<string, { query: unknown; args: unknown }>) => ({
		access: mockUseQuery(queries.access?.query, queries.access?.args ?? "skip"),
	}),
}));

jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

describe("AccessProvider", () => {
	beforeEach(() => {
		mockUseQuery.mockReset().mockReturnValue(undefined);
		mockActivateTrial.mockClear();
		mockSyncPaidAccess.mockClear();
		jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(null);
		jest.mocked(SecureStore.setItemAsync).mockClear();
		mockSession.isConvexUserSynced = false;
		mockSession.onboardingCompletionStatus = "none";
		mockSession.user = { clerkId: "user_123" };
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	const AccessProbe = () => {
		const {
			access,
			isAccessLoading,
			isAccessUnavailable,
			isAccessRetrying,
			retryAccess,
		} = useAccess();
		return (
			<>
				<Text>
					{isAccessLoading
						? "loading"
						: isAccessUnavailable
							? "unavailable"
							: (access?.state ?? "idle")}
				</Text>
				<Text onPress={retryAccess}>Retry</Text>
				{isAccessRetrying ? <Text>retrying</Text> : null}
			</>
		);
	};

	test.each([
		"missing",
		"stale",
		"expired",
	])("does not invent an expired trial when verification times out with %s cached access", async (cache) => {
		jest.useFakeTimers();
		mockSession.isConvexUserSynced = true;
		if (cache !== "missing") {
			jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
				JSON.stringify({
					access: {
						state: cache === "expired" ? "expired" : "trial",
						canUseApp: cache !== "expired",
						trialExpiresAt:
							cache === "expired"
								? Date.now() - 1
								: Date.now() + 14 * 24 * 60 * 60 * 1000,
					},
					verifiedAt:
						cache === "stale" ? Date.now() - 73 * 60 * 60 * 1000 : Date.now(),
				}),
			);
		}
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		await act(async () => jest.advanceTimersByTime(1_501));
		expect(screen.getByText("unavailable")).toBeOnTheScreen();
		expect(screen.queryByText("expired")).toBeNull();
		mockUseQuery.mockReturnValue({
			canUseApp: true,
			state: "trial",
			trialExpiresAt: Date.now() + 100_000,
		});
		await screen.rerender(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		expect(screen.getByText("trial")).toBeOnTheScreen();
	});

	test("retries access verification without a purchase or trial activation", async () => {
		jest.useFakeTimers();
		mockSession.isConvexUserSynced = true;
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		await act(async () => jest.advanceTimersByTime(1_501));
		const previousArgs = mockUseQuery.mock.lastCall?.[1];
		await fireEvent.press(screen.getByText("Retry"));
		expect(mockUseQuery.mock.lastCall?.[1]).not.toEqual(previousArgs);
		expect(screen.getByText("unavailable")).toBeOnTheScreen();
		expect(screen.getByText("retrying")).toBeOnTheScreen();
		await act(async () => jest.advanceTimersByTime(1_501));
		expect(screen.getByText("unavailable")).toBeOnTheScreen();
		expect(screen.queryByText("retrying")).toBeNull();
		await fireEvent.press(screen.getByText("Retry"));
		expect(screen.getByText("retrying")).toBeOnTheScreen();
		expect(mockActivateTrial).not.toHaveBeenCalled();
		expect(mockSyncPaidAccess).not.toHaveBeenCalled();
	});

	test("does not carry an unavailable verification into another account", async () => {
		jest.useFakeTimers();
		mockSession.isConvexUserSynced = true;
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		await act(async () => jest.advanceTimersByTime(1_501));
		expect(screen.getByText("unavailable")).toBeOnTheScreen();
		mockSession.user = { clerkId: "user_other" };
		await screen.rerender(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		expect(screen.getByText("loading")).toBeOnTheScreen();
	});

	test("makes a failed query recoverable without exposing its diagnostic error", async () => {
		mockSession.isConvexUserSynced = true;
		mockUseQuery.mockReturnValue(new Error("Internal diagnostic detail"));
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		expect(screen.getByText("unavailable")).toBeOnTheScreen();
		expect(screen.queryByText("Internal diagnostic detail")).toBeNull();
		mockUseQuery.mockReturnValue({ canUseApp: false, state: "expired" });
		await screen.rerender(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		expect(screen.getByText("expired")).toBeOnTheScreen();
	});

	test("keeps fresh verified offline trial access available", async () => {
		jest.useFakeTimers();
		mockSession.isConvexUserSynced = true;
		jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
			JSON.stringify({
				access: {
					canUseApp: true,
					state: "trial",
					trialExpiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
				},
				verifiedAt: Date.now(),
			}),
		);
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);
		await act(async () => jest.advanceTimersByTime(1_501));
		expect(screen.getByText("trial")).toBeOnTheScreen();
	});

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

	test("clears an earlier access timeout while onboarding blocks the query", async () => {
		jest.useFakeTimers();
		mockSession.isConvexUserSynced = true;
		const screen = await render(
			<AccessProvider>
				<AccessProbe />
			</AccessProvider>,
		);

		try {
			await act(async () => {
				jest.advanceTimersByTime(2_000);
			});
			expect(screen.getByText("unavailable")).toBeOnTheScreen();

			mockSession.onboardingCompletionStatus = "pending";
			await screen.rerender(
				<AccessProvider>
					<AccessProbe />
				</AccessProvider>,
			);
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
