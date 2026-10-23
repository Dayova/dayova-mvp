import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { AppState, Text } from "react-native";
import { api } from "#convex/_generated/api";
import { useLearningQuery } from "~/hooks/use-learning-query";
import type { AccessSnapshot } from "~/lib/access-policy";
import { AccessProvider, useAccess } from "./AccessContext";

const serverNow = Date.parse("2026-11-19T12:00:00Z");
const mockSession = {
	user: { clerkId: "user_a" },
	isSessionLoading: false,
	isConvexUserSynced: true,
	isPostAuthSyncing: false,
	onboardingCompletionStatus: "none",
};
const mockVerify =
	jest.fn<() => Promise<{ access: AccessSnapshot; serverNow: number }>>();
const mockQuery = jest.fn<() => AccessSnapshot | undefined>(() => undefined);
let mockElapsed = 0;
const mockConnection = { isWebSocketConnected: true };
const mockLearningQuery = jest.fn<() => unknown>();
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
	useOnboardingHandoff: () => ({ retryPostAuthSync: () => {} }),
}));
jest.mock("convex/react", () => ({
	useConvexConnectionState: () => mockConnection,
	useConvexAuth: () => ({ isAuthenticated: true }),
	useAction: () => jest.fn(),
	useMutation: (ref: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(ref as Parameters<typeof getFunctionName>[0]) ===
			"accessState:refreshMyAccess"
			? mockVerify
			: jest.fn();
	},
	useQuery: (ref: unknown, args: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		return getFunctionName(
			ref as Parameters<typeof getFunctionName>[0],
		).startsWith("dayEntries:")
			? args === "skip"
				? undefined
				: mockLearningQuery()
			: mockQuery();
	},
}));
jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));
function Probe() {
	const { access, isAccessLoading, isVerificationRequired } = useAccess();
	return (
		<Text>
			{isVerificationRequired
				? "verification-required"
				: isAccessLoading
					? "loading"
					: (access?.state ?? "idle")}
		</Text>
	);
}
function App() {
	return (
		<AccessProvider>
			<Probe />
		</AccessProvider>
	);
}
beforeEach(() => {
	jest.useFakeTimers();
	jest.spyOn(performance, "now").mockImplementation(() => mockElapsed);
	mockElapsed = 0;
	AppState.currentState = "active";
	mockConnection.isWebSocketConnected = true;
	mockLearningQuery.mockReset();
	mockSession.user = { clerkId: "user_a" };
	mockSession.isConvexUserSynced = true;
	mockQuery.mockReset().mockReturnValue(undefined);
	mockVerify.mockReset().mockResolvedValue({
		access: {
			state: "trial",
			canUseApp: true,
			trialExpiresAt: serverNow + 1000,
		},
		serverNow,
	});
});
afterEach(() => {
	jest.restoreAllMocks();
	jest.useRealTimers();
});

test("a cold process cannot authorize from the old persisted cache or a cached positive query", async () => {
	jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
		JSON.stringify({
			access: { state: "paid", canUseApp: true },
			verifiedAt: Date.now(),
		}),
	);
	mockQuery.mockReturnValue({ state: "paid", canUseApp: true });
	mockVerify.mockRejectedValue(new Error("offline"));
	const screen = await render(<App />);
	expect(screen.getByText("loading")).toBeOnTheScreen();
	await act(async () => jest.advanceTimersByTime(1501));
	expect(screen.getByText("verification-required")).toBeOnTheScreen();
});
test("online server time grants valid access even when the device clock is years ahead", async () => {
	jest.setSystemTime(new Date("2100-01-01T00:00:00Z"));
	const screen = await render(<App />);
	expect(screen.getByText("trial")).toBeOnTheScreen();
});
test("rewinding device time cannot extend a verified trial while offline", async () => {
	mockQuery.mockReturnValue({
		state: "trial",
		canUseApp: true,
		trialExpiresAt: serverNow + 1000,
	});
	const screen = await render(<App />);
	expect(screen.getByText("trial")).toBeOnTheScreen();
	mockVerify.mockRejectedValue(new Error("offline"));
	jest.setSystemTime(new Date("2000-01-01T00:00:00Z"));
	mockElapsed = 1000;
	await act(async () => jest.advanceTimersByTime(1000));
	expect(screen.getByText("expired")).toBeOnTheScreen();
});
test("offline access ends at 72 elapsed hours even for indefinite paid access", async () => {
	mockVerify.mockResolvedValue({
		access: { state: "paid", canUseApp: true },
		serverNow,
	});
	const screen = await render(<App />);
	expect(screen.getByText("paid")).toBeOnTheScreen();
	mockVerify.mockRejectedValue(new Error("offline"));
	mockElapsed = 72 * 60 * 60 * 1000;
	await act(async () => jest.advanceTimersByTime(30_000));
	expect(screen.getByText("verification-required")).toBeOnTheScreen();
});
test("a confirmed denial replaces the retained positive grant", async () => {
	const screen = await render(<App />);
	mockVerify.mockResolvedValue({
		access: { state: "expired", canUseApp: false },
		serverNow,
	});
	mockQuery.mockReturnValue({ state: "expired", canUseApp: false });
	await screen.rerender(<App />);
	expect(screen.getByText("expired")).toBeOnTheScreen();
});
test("an old account's in-flight response cannot authorize a switched account", async () => {
	let resolve!: (value: { access: AccessSnapshot; serverNow: number }) => void;
	mockVerify.mockImplementationOnce(
		() =>
			new Promise((settle) => {
				resolve = settle;
			}),
	);
	const screen = await render(<App />);
	mockSession.user = { clerkId: "user_b" };
	mockVerify.mockRejectedValue(new Error("offline"));
	await screen.rerender(<App />);
	await act(async () =>
		resolve({ access: { state: "paid", canUseApp: true }, serverNow }),
	);
	await act(async () => jest.advanceTimersByTime(1501));
	expect(screen.getByText("verification-required")).toBeOnTheScreen();
});
test("remounting offline requires verification again, despite a grant in the earlier mount", async () => {
	const first = await render(<App />);
	expect(first.getByText("trial")).toBeOnTheScreen();
	await first.unmount();
	mockVerify.mockRejectedValue(new Error("offline"));
	const second = await render(<App />);
	await act(async () => jest.advanceTimersByTime(1501));
	expect(second.getByText("verification-required")).toBeOnTheScreen();
});

test("backgrounding invalidates the lease and returning offline cannot restore it", async () => {
	let change!: Parameters<typeof AppState.addEventListener>[1];
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, listener) => {
			change = listener;
			return { remove: () => {} };
		});
	const screen = await render(<App />);
	expect(screen.getByText("trial")).toBeOnTheScreen();
	mockVerify.mockRejectedValue(new Error("offline"));
	await act(async () => change("background"));
	await act(async () => change("active"));
	await act(async () => jest.advanceTimersByTime(1501));
	expect(screen.getByText("verification-required")).toBeOnTheScreen();
	mockVerify.mockResolvedValue({
		access: { state: "paid", canUseApp: true },
		serverNow,
	});
	await act(async () => jest.advanceTimersByTime(30_000));
	expect(screen.getByText("paid")).toBeOnTheScreen();
});

test("protected data subscriptions wait for the real provider's online verification", async () => {
	let resolve!: (value: { access: AccessSnapshot; serverNow: number }) => void;
	mockVerify.mockImplementationOnce(
		() =>
			new Promise((settle) => {
				resolve = settle;
			}),
	);
	mockLearningQuery.mockImplementation(() => {
		throw new Error("A hidden route subscribed before access verification");
	});
	function LearningProbe() {
		const data = useLearningQuery(api.dayEntries.listByDayKeys, {
			dayKeys: ["2026-11-19"],
		});
		return <Text>{data ? "learning-ready" : "learning-waiting"}</Text>;
	}
	const screen = await render(
		<AccessProvider>
			<LearningProbe />
		</AccessProvider>,
	);
	expect(screen.getByText("learning-waiting")).toBeOnTheScreen();
	mockLearningQuery.mockReturnValue({ "2026-11-19": [] });
	await act(async () =>
		resolve({ access: { state: "paid", canUseApp: true }, serverNow }),
	);
	expect(screen.getByText("learning-ready")).toBeOnTheScreen();
});
test("reconnecting starts a fresh server verification after an offline cold start", async () => {
	mockConnection.isWebSocketConnected = false;
	const screen = await render(<App />);
	await act(async () => jest.advanceTimersByTime(1501));
	expect(screen.getByText("verification-required")).toBeOnTheScreen();
	mockConnection.isWebSocketConnected = true;
	await screen.rerender(<App />);
	expect(screen.getByText("trial")).toBeOnTheScreen();
});

test("an inactive foreground interruption preserves the verified offline lease", async () => {
	let change!: Parameters<typeof AppState.addEventListener>[1];
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, listener) => {
			change = listener;
			return { remove: () => {} };
		});
	mockVerify.mockResolvedValue({
		access: {
			state: "trial",
			canUseApp: true,
			trialExpiresAt: Date.parse("2026-11-20T12:00:00Z"),
		},
		serverNow,
	});
	const screen = await render(<App />);
	expect(screen.getByText("trial")).toBeOnTheScreen();
	mockVerify.mockRejectedValue(new Error("offline"));
	await act(async () => change("inactive"));
	await act(async () => change("active"));
	await act(async () => jest.advanceTimersByTime(1501));
	expect(screen.getByText("trial")).toBeOnTheScreen();
});

test("a process mounted in the background waits for foreground verification", async () => {
	AppState.currentState = "background";
	let change!: Parameters<typeof AppState.addEventListener>[1];
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, listener) => {
			change = listener;
			return { remove: () => {} };
		});
	mockVerify.mockResolvedValue({
		access: { state: "paid", canUseApp: true },
		serverNow,
	});
	const screen = await render(<App />);
	expect(screen.getByText("loading")).toBeOnTheScreen();
	await act(async () => jest.advanceTimersByTime(1501));
	expect(screen.getByText("verification-required")).toBeOnTheScreen();
	await act(async () => change("active"));
	expect(screen.getByText("paid")).toBeOnTheScreen();
});
