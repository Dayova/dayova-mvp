import { afterEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { Text } from "react-native";
import type { AccessSnapshot } from "~/lib/access-policy";
import { AccessProvider, useAccess } from "./AccessContext";

// Keep the real Convex useQueries/useSubscription implementation. A mocked
// useQueries would miss render loops caused by unstable subscription requests.
jest.mock("convex/react", () => ({
	...jest.requireActual<typeof import("convex/react")>("convex/react"),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useAction: () => jest.fn(),
	useMutation: () => jest.fn(),
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: { clerkId: "subscription-test" },
		isSessionLoading: false,
		isConvexUserSynced: true,
		onboardingCompletionStatus: "none",
	}),
}));
jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));

function Probe() {
	const { access, isAccessUnavailable, retryAccess } = useAccess();
	return (
		<>
			<Text>
				{isAccessUnavailable ? "unavailable" : (access?.state ?? "loading")}
			</Text>
			<Text onPress={retryAccess}>Retry</Text>
		</>
	);
}

afterEach(() => {
	jest.useRealTimers();
});

test("the real Convex subscription mounts, times out and recovers without a render loop", async () => {
	jest.useFakeTimers();
	let result: AccessSnapshot | undefined;
	const listeners = new Set<() => void>();
	const onUpdate = jest.fn((callback: () => void) => {
		listeners.add(callback);
		return () => {
			listeners.delete(callback);
		};
	});
	const client = {
		watchQuery: () => ({
			localQueryResult: () => result,
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
	await act(async () => {
		result = {
			canUseApp: true,
			state: "trial",
			trialExpiresAt: Date.now() + 86_400_000,
		};
		for (const notify of listeners) notify();
	});
	expect(screen.getByText("trial")).toBeOnTheScreen();
	expect(onUpdate).toHaveBeenCalledTimes(2);
	await screen.unmount();
	expect(listeners.size).toBe(0);
});
