import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthNavigationGate } from "~/components/auth-navigation-gate";
import {
	type AccessSnapshot,
	OFFLINE_ACCESS_WINDOW_MS,
} from "~/lib/access-policy";
import { AccessProvider, useAccess } from "./AccessContext";
import { AuthProvider, useAuthSession } from "./AuthContext";

const makeUser = (id = "user_123") => ({
	id,
	primaryEmailAddress: { emailAddress: `${id}@example.com` },
	unsafeMetadata: {},
	fullName: "Test User",
});
let mockClerkUser: ReturnType<typeof makeUser> | null = makeUser();
const mockClerk = { loaded: true, session: { currentTask: null } };
const mockClear = jest.fn();
const mockSync = jest.fn<() => Promise<unknown>>(async () => ({}));
const mockEntitlementSync = jest.fn(async () => ({ active: true }));
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
let mockPathname = "/learning-plans/example";
let mockAuthenticated = true;
let mockServerAccess: AccessSnapshot | undefined;
const mockQueryArgs = jest.fn();

jest.mock("@clerk/expo", () => ({
	useClerk: () => mockClerk,
	useUser: () => ({ user: mockClerkUser, isLoaded: true }),
	useSignIn: () => ({}),
	useReverification: (callback: unknown) => callback,
	isClerkAPIResponseError: () => false,
}));
jest.mock("convex/react", () => ({
	useConvex: () => ({ url: "https://test.convex.cloud" }),
	useMutation: () => mockSync,
	useAction: () => mockEntitlementSync,
	useConvexAuth: () => ({ isAuthenticated: mockAuthenticated }),
	useQuery: (_query: unknown, args: unknown) => {
		mockQueryArgs(args);
		return args === "skip" ? undefined : mockServerAccess;
	},
}));
jest.mock("posthog-react-native", () => ({ usePostHog: () => null }));
jest.mock("~/context/OnboardingContext", () => ({
	useOnboarding: () => ({ clearAnswers: mockClear }),
}));
jest.mock("~/lib/analytics", () => ({ isPostHogConfigured: false }));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/lib/pending-onboarding-sync-secure-store", () => ({
	getOnboardingAccountFingerprint: async () => "test-fingerprint",
	pendingOnboardingSyncOutbox: { resume: async () => ({ status: "none" }) },
}));
jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-router", () => ({
	usePathname: () => mockPathname,
	useRootNavigationState: () => ({ key: "root" }),
	useRouter: () => mockRouter,
}));

function Probe() {
	const { isConvexUserSynced, isPostAuthSyncing, postAuthSyncError } =
		useAuthSession();
	const { access, refreshPaidAccess } = useAccess();
	return (
		<>
			<Text>Lernplan</Text>
			<Text testID="profile-state">
				{isConvexUserSynced ? "ready" : "pending"}/
				{isPostAuthSyncing ? "syncing" : "idle"}
			</Text>
			<Text testID="access-state">{access?.state ?? "unknown"}</Text>
			{postAuthSyncError ? <Text>Profile sync failed</Text> : null}
			<Text onPress={() => void refreshPaidAccess()}>Refresh access</Text>
		</>
	);
}

function App() {
	return (
		<AuthProvider>
			<AccessProvider>
				<AuthNavigationGate>
					<Probe />
				</AuthNavigationGate>
			</AccessProvider>
		</AuthProvider>
	);
}

function deferSync() {
	let resolve!: (value: unknown) => void;
	mockSync.mockImplementationOnce(
		() =>
			new Promise((settle) => {
				resolve = settle;
			}),
	);
	return async () => {
		await act(async () => resolve({}));
	};
}

type RenderedApp = Awaited<ReturnType<typeof render>>;
const expectVisible = (screen: RenderedApp) => {
	expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
	expect(
		screen.getByTestId("auth-route-content").props.className,
	).not.toContain("opacity-0");
	expect(screen.getByText("Lernplan")).toBeOnTheScreen();
};
const openApp = async () => {
	const screen = await render(<App />);
	await waitFor(() => expectVisible(screen));
	return screen;
};

describe("session refresh across the app", () => {
	beforeEach(() => {
		mockClerkUser = makeUser();
		mockAuthenticated = true;
		mockServerAccess = { canUseApp: true, state: "paid" };
		mockPathname = "/learning-plans/example";
		mockSync.mockReset().mockResolvedValue({});
		mockReplace.mockReset();
		mockQueryArgs.mockReset();
		global.requestAnimationFrame = jest.fn(() => 1);
		global.cancelAnimationFrame = jest.fn();
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	test.each([
		"/learning-plans/new",
		"/learning-plans/example",
		"/home",
	])("keeps %s visible during same-account refreshes", async (pathname) => {
		mockPathname = pathname;
		const screen = await openApp();
		for (let refresh = 0; refresh < 3; refresh++) {
			const finishSync = deferSync();
			mockClerkUser = makeUser();
			await screen.rerender(<App />);
			expectVisible(screen);
			expect(screen.getByTestId("profile-state")).toHaveTextContent(
				"ready/syncing",
			);
			await finishSync();
			expectVisible(screen);
		}
		expect(mockReplace).not.toHaveBeenCalled();
	});

	test("continues synchronizing changed profile details without blanking the app", async () => {
		const screen = await openApp();
		const finishSync = deferSync();
		mockClerkUser = { ...makeUser(), fullName: "Changed Name" };
		await screen.rerender(<App />);
		expect(mockSync).toHaveBeenLastCalledWith(
			expect.objectContaining({ name: "Changed Name" }),
		);
		expectVisible(screen);
		await finishSync();
	});

	test("keeps verified access visible while its query refreshes", async () => {
		const screen = await openApp();
		mockServerAccess = undefined;
		await screen.rerender(<App />);
		expectVisible(screen);
		expect(screen.getByTestId("access-state")).toHaveTextContent("paid");
	});

	test("refreshes access after a purchase without blanking the current screen", async () => {
		jest.useFakeTimers();
		const screen = await openApp();
		const initialArgs = mockQueryArgs.mock.lastCall?.[0];
		await act(async () => jest.advanceTimersByTime(100));
		mockServerAccess = undefined;
		await fireEvent.press(screen.getByText("Refresh access"));
		expect(mockEntitlementSync).toHaveBeenCalledWith({});
		expect(mockQueryArgs.mock.lastCall?.[0]).not.toEqual(initialArgs);
		expectVisible(screen);
	});

	test("keeps the current account visible when a background profile sync fails", async () => {
		jest.useFakeTimers();
		const screen = await openApp();
		mockSync.mockRejectedValue(new Error("Network unavailable"));
		mockClerkUser = makeUser();
		await screen.rerender(<App />);
		for (const delay of [750, 1250, 2000]) {
			await act(async () => jest.advanceTimersByTime(delay));
			expectVisible(screen);
		}
		expect(screen.getByText("Profile sync failed")).toBeOnTheScreen();
		expect(screen.getByTestId("profile-state")).toHaveTextContent("ready/idle");
	});

	test.each([
		"trial",
		"paid",
		"billingGrace",
	] as const)("expires retained %s access while a refreshed query is pending", async (state) => {
		jest.useFakeTimers();
		const expiry = Date.now() + 1000;
		mockServerAccess =
			state === "trial"
				? { state, canUseApp: true, trialExpiresAt: expiry }
				: state === "billingGrace"
					? { state, canUseApp: true, subscriptionGraceExpiresAt: expiry }
					: { state, canUseApp: true, subscriptionExpiresAt: expiry };
		const screen = await openApp();
		mockServerAccess = undefined;
		// The scheduled expiry starts the new query; its result is still pending.
		await act(async () => jest.advanceTimersByTime(1001));
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		expect(
			screen.getByTestId("access-state", { includeHiddenElements: true }),
		).toHaveTextContent("expired");
	});

	test("bounds retained access by the existing offline window", async () => {
		jest.useFakeTimers();
		const screen = await openApp();
		mockServerAccess = undefined;
		await screen.rerender(<App />);
		jest.setSystemTime(Date.now() + OFFLINE_ACCESS_WINDOW_MS + 1);
		await act(async () => jest.advanceTimersByTime(30_000));
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		expect(
			screen.getByTestId("access-state", { includeHiddenElements: true }),
		).toHaveTextContent("expired");
	});

	test("still schedules expiry when access starts refreshing before it expires", async () => {
		jest.useFakeTimers();
		mockServerAccess = {
			state: "trial",
			canUseApp: true,
			trialExpiresAt: Date.now() + 1000,
		};
		const screen = await openApp();
		mockServerAccess = undefined;
		await screen.rerender(<App />);
		expectVisible(screen);
		await act(async () => jest.advanceTimersByTime(1001));
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
	});

	test("ignores a profile response from the previous account", async () => {
		const screen = await openApp();
		const finishOldSync = deferSync();
		mockClerkUser = makeUser();
		await screen.rerender(<App />);
		const finishNewSync = deferSync();
		mockClerkUser = makeUser("user_other");
		await screen.rerender(<App />);
		await finishOldSync();
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		expect(
			screen.getByTestId("profile-state", { includeHiddenElements: true }),
		).toHaveTextContent("pending/syncing");
		await finishNewSync();
		expectVisible(screen);
	});

	test("masks the first profile sync and access lookup", async () => {
		const finishSync = deferSync();
		const screen = await render(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		mockServerAccess = undefined;
		await finishSync();
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		mockServerAccess = { canUseApp: true, state: "paid" };
		await screen.rerender(<App />);
		expectVisible(screen);
	});

	test("does not retain access after a confirmed denial", async () => {
		const screen = await openApp();
		mockServerAccess = { canUseApp: false, state: "expired" };
		await screen.rerender(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		expect(
			screen.getByTestId("access-state", { includeHiddenElements: true }),
		).toHaveTextContent("expired");
		mockServerAccess = undefined;
		await screen.rerender(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
	});

	test("does not expose the old account while another account syncs", async () => {
		const screen = await openApp();
		const finishSync = deferSync();
		mockClerkUser = makeUser("user_other");
		await screen.rerender(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		mockServerAccess = undefined;
		await finishSync();
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
	});

	test("masks sign-out and bootstraps even when the same user signs in again", async () => {
		const screen = await openApp();
		mockClerkUser = null;
		await screen.rerender(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		const finishSync = deferSync();
		mockClerkUser = makeUser();
		await screen.rerender(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		mockServerAccess = undefined;
		await finishSync();
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
	});

	test("masks a confirmed backend authentication loss", async () => {
		const screen = await openApp();
		mockAuthenticated = false;
		await screen.rerender(<App />);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
	});
});
