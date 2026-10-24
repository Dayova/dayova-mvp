import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { AppState, Text } from "react-native";
import type { AccessSnapshot } from "~/lib/access-policy";
import { AccessProvider, useAccess } from "./AccessContext";

// Keep the real Convex useQueries/useSubscription implementation. A mocked
// useQueries would miss render loops caused by unstable subscription requests.
const mockVerify =
	jest.fn<() => Promise<{ access: AccessSnapshot; serverNow: number }>>();
jest.mock("convex/react", () => ({
	...jest.requireActual<typeof import("convex/react")>("convex/react"),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useAction: () => jest.fn(),
	useMutation: () => mockVerify,
	useConvexConnectionState: () => ({ isWebSocketConnected: true }),
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: { clerkId: "subscription-test" },
		isSessionLoading: false,
		isConvexUserSynced: true,
		onboardingCompletionStatus: "none",
	}),
	useOnboardingHandoff: () => ({ retryPostAuthSync: () => {} }),
}));
jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));

function Probe() {
	const { access, isVerificationRequired, retryAccessVerification } =
		useAccess();
	return (
		<>
			<Text>
				{isVerificationRequired ? "unavailable" : (access?.state ?? "loading")}
			</Text>
			<Text onPress={() => void retryAccessVerification().catch(() => {})}>
				Retry
			</Text>
		</>
	);
}

afterEach(() => {
	jest.useRealTimers();
});

test.each([
	false,
	true,
])("the real Convex subscription recovers through fresh verification (query error: %s)", async (queryFails) => {
	jest.useFakeTimers();
	AppState.currentState = "active";
	mockVerify.mockReset().mockRejectedValue(new Error("offline"));
	let result: AccessSnapshot | Error | undefined = queryFails
		? new Error("query unavailable")
		: undefined;
	const listeners = new Set<() => void>();
	const onUpdate = jest.fn((callback: () => void) => {
		listeners.add(callback);
		return () => {
			listeners.delete(callback);
		};
	});
	const client = {
		watchQuery: () => ({
			localQueryResult: () => {
				if (result instanceof Error) throw result;
				return result;
			},
			onUpdate,
			journal: () => undefined,
		}),
	} as unknown as ConvexReactClient;
	const screen = await render(
		<ConvexProvider client={client}>
			<AccessProvider>
				<Probe />
			</AccessProvider>
		</ConvexProvider>,
	);
	expect(screen.getByText("loading")).toBeOnTheScreen();
	await act(async () => jest.advanceTimersByTime(1_501));
	expect(screen.getByText("unavailable")).toBeOnTheScreen();
	await fireEvent.press(screen.getByText("Retry"));
	expect(screen.getByText("unavailable")).toBeOnTheScreen();
	const recoveredAccess: AccessSnapshot = {
		canUseApp: true,
		state: "trial",
		trialExpiresAt: Date.now() + 86_400_000,
	};
	expect(listeners.size).toBeGreaterThan(0);
	await act(async () => {
		result = recoveredAccess;
		for (const notify of listeners) notify();
	});
	expect(screen.queryByText("trial")).toBeNull();
	mockVerify.mockResolvedValue({
		access: recoveredAccess,
		serverNow: Date.now(),
	});
	await fireEvent.press(screen.getByText("Retry"));
	expect(screen.getByText("trial")).toBeOnTheScreen();
	await screen.unmount();
	expect(listeners.size).toBe(0);
});
