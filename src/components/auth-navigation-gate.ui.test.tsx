import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
	ONBOARDING_CREATION_PATH,
	type OnboardingCompletionStatus,
} from "~/lib/auth-routing";
import { AuthNavigationGate } from "./auth-navigation-gate";

const mockReplace = jest.fn();
const mockRouterState = {
	pathname: "/",
	rootNavigationState: { key: "root" } as { key: string } | undefined,
};
const mockSession = {
	isSessionLoading: false,
	onboardingCompletionStatus: "none" as OnboardingCompletionStatus,
	pendingSessionTask: null as string | null,
	user: { clerkId: "user_123" } as { clerkId: string } | null,
};
const mockAccess = {
	access: { state: "paid" } as
		| {
				state:
					| "needsActivation"
					| "trial"
					| "paid"
					| "billingGrace"
					| "expired";
		  }
		| undefined,
	isAccessLoading: false,
	isAccessUnavailable: false,
	isAccessRetrying: false,
	retryAccess: jest.fn(),
};

jest.mock("expo-router", () => ({
	usePathname: () => mockRouterState.pathname,
	useRootNavigationState: () => mockRouterState.rootNavigationState,
	useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => mockAccess,
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

describe("AuthNavigationGate", () => {
	let animationFrames: FrameRequestCallback[];

	beforeEach(() => {
		mockReplace.mockReset();
		mockRouterState.pathname = "/";
		mockRouterState.rootNavigationState = { key: "root" };
		mockSession.isSessionLoading = false;
		mockSession.onboardingCompletionStatus = "none";
		mockSession.pendingSessionTask = null;
		mockSession.user = { clerkId: "user_123" };
		mockAccess.access = { state: "paid" };
		mockAccess.isAccessLoading = false;
		mockAccess.isAccessUnavailable = false;
		mockAccess.isAccessRetrying = false;
		mockAccess.retryAccess.mockReset();
		animationFrames = [];
		global.requestAnimationFrame = (callback: FrameRequestCallback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		};
		global.cancelAnimationFrame = jest.fn();
	});

	const flushAnimationFrames = () => {
		const callbacks = animationFrames.splice(0);
		for (const callback of callbacks) callback(performance.now());
	};

	test("still redirects a server-confirmed expired account to the paywall", async () => {
		mockRouterState.pathname = "/home";
		mockAccess.access = { state: "expired" };
		const screen = await render(
			<AuthNavigationGate>
				<Text>Private learning content</Text>
			</AuthNavigationGate>,
		);
		expect(screen.queryByText("Private learning content")).toBeNull();
		expect(screen.queryByText("Zugang gerade nicht prüfbar")).toBeNull();
		await act(flushAnimationFrames);
		expect(mockReplace).toHaveBeenCalledWith("/paywall");
	});

	test("offers verification retry while protecting the current route without a paywall redirect", async () => {
		mockRouterState.pathname = "/home";
		mockAccess.access = undefined;
		mockAccess.isAccessUnavailable = true;
		const screen = await render(
			<AuthNavigationGate>
				<Text>Private learning content</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByText("Zugang gerade nicht prüfbar")).toBeOnTheScreen();
		expect(screen.queryByText("Private learning content")).toBeNull();
		await act(flushAnimationFrames);
		expect(mockReplace).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut prüfen" }),
		);
		expect(mockAccess.retryAccess).toHaveBeenCalledTimes(1);
		mockAccess.isAccessRetrying = true;
		await screen.rerender(
			<AuthNavigationGate>
				<Text>Private learning content</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByRole("button")).toBeDisabled();
		expect(screen.getByText("Zugang wird geprüft …")).toBeOnTheScreen();
		mockAccess.access = { state: "trial" };
		mockAccess.isAccessUnavailable = false;
		await screen.rerender(
			<AuthNavigationGate>
				<Text>Private learning content</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByText("Private learning content")).toBeOnTheScreen();
		expect(screen.queryByText("Zugang gerade nicht prüfbar")).toBeNull();
	});

	test("never exposes a public route while restoring an authenticated session", async () => {
		const screen = await render(
			<AuthNavigationGate>
				<Text>Öffentliche Landingpage</Text>
			</AuthNavigationGate>,
		);

		const routeContent = screen.getByTestId("auth-route-content", {
			includeHiddenElements: true,
		});
		expect(routeContent.props.accessibilityElementsHidden).toBe(true);
		expect(routeContent.props.importantForAccessibility).toBe(
			"no-hide-descendants",
		);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();

		await act(flushAnimationFrames);
		expect(mockReplace).toHaveBeenCalledWith("/home");

		mockRouterState.pathname = "/home";
		await screen.rerender(
			<AuthNavigationGate>
				<Text>Home</Text>
			</AuthNavigationGate>,
		);
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
	});

	test("masks route content until the initial session lookup settles", async () => {
		mockSession.isSessionLoading = true;
		mockSession.user = null;

		const screen = await render(
			<AuthNavigationGate>
				<Text>Öffentliche Landingpage</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByTestId("auth-bootstrap-mask")).toBeOnTheScreen();
		expect(mockReplace).not.toHaveBeenCalled();
	});

	test("shows the public route after a signed-out session settles", async () => {
		mockSession.user = null;

		const screen = await render(
			<AuthNavigationGate>
				<Text>Öffentliche Landingpage</Text>
			</AuthNavigationGate>,
		);

		const routeContent = screen.getByTestId("auth-route-content");
		expect(routeContent.props.accessibilityElementsHidden).toBe(false);
		expect(routeContent.props.importantForAccessibility).toBe("auto");
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
		expect(mockReplace).not.toHaveBeenCalled();
	});

	test("keeps durable onboarding recovery above a cached paid-access redirect", async () => {
		mockRouterState.pathname = ONBOARDING_CREATION_PATH;
		mockSession.onboardingCompletionStatus = "pending";
		mockAccess.access = { state: "paid" };

		const screen = await render(
			<AuthNavigationGate>
				<Text>Onboarding wiederherstellen</Text>
			</AuthNavigationGate>,
		);

		expect(screen.getByText("Onboarding wiederherstellen")).toBeOnTheScreen();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
		await act(flushAnimationFrames);
		expect(mockReplace).not.toHaveBeenCalled();
	});

	test("does not hide the confirmed trial handoff behind access loading", async () => {
		mockRouterState.pathname = ONBOARDING_CREATION_PATH;
		mockSession.onboardingCompletionStatus = "ready_for_trial";
		mockAccess.access = undefined;
		mockAccess.isAccessLoading = true;

		const screen = await render(
			<AuthNavigationGate>
				<Text>Onboarding abgeschlossen</Text>
			</AuthNavigationGate>,
		);

		expect(screen.getByText("Onboarding abgeschlossen")).toBeOnTheScreen();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
		await act(flushAnimationFrames);
		expect(mockReplace).not.toHaveBeenCalled();
	});
});
