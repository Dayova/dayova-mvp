import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthNavigationGate } from "./auth-navigation-gate";

const mockReplace = jest.fn();
const mockRouterState = {
	pathname: "/",
	rootNavigationState: { key: "root" } as { key: string } | undefined,
};
const mockSession = {
	isSessionLoading: false,
	pendingSessionTask: null as string | null,
	user: { id: "user_123" } as { id: string } | null,
};

jest.mock("expo-router", () => ({
	usePathname: () => mockRouterState.pathname,
	useRootNavigationState: () => mockRouterState.rootNavigationState,
	useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

describe("AuthNavigationGate", () => {
	let animationFrames: FrameRequestCallback[];

	beforeEach(() => {
		mockReplace.mockReset();
		mockRouterState.pathname = "/";
		mockRouterState.rootNavigationState = { key: "root" };
		mockSession.isSessionLoading = false;
		mockSession.pendingSessionTask = null;
		mockSession.user = { id: "user_123" };
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

	test("never exposes a public route while restoring an authenticated session", async () => {
		const screen = await render(
			<AuthNavigationGate>
				<Text>Öffentliche Landingpage</Text>
			</AuthNavigationGate>,
		);

		const routeContent = screen.getByTestId("auth-route-content", {
			includeHiddenElements: true,
		});
		expect(routeContent.props.className).toContain("opacity-0");
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
		expect(
			screen.getByTestId("auth-route-content").props.className,
		).not.toContain("opacity-0");
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

		expect(
			screen.getByTestId("auth-route-content", {
				includeHiddenElements: true,
			}).props.className,
		).toContain("opacity-0");
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
		expect(routeContent.props.className).not.toContain("opacity-0");
		expect(routeContent.props.accessibilityElementsHidden).toBe(false);
		expect(routeContent.props.importantForAccessibility).toBe("auto");
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
		expect(mockReplace).not.toHaveBeenCalled();
	});
});
