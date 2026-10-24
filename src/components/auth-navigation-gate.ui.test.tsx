import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
	ONBOARDING_CREATION_PATH,
	type OnboardingCompletionStatus,
} from "~/lib/auth-routing";
import { AuthNavigationGate } from "./auth-navigation-gate";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRetryAccess = jest.fn(async () => {});
const mockReloadApp = jest.fn(async () => {});
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
	isVerificationRequired: false,
	retryAccessVerification: mockRetryAccess,
};

jest.mock("expo-router", () => ({
	usePathname: () => mockRouterState.pathname,
	useRootNavigationState: () => mockRouterState.rootNavigationState,
	useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock("expo", () => ({
	...jest.requireActual<typeof import("expo")>("expo"),
	reloadAppAsync: () => mockReloadApp(),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

jest.mock("~/context/AccessContext", () => ({
	useAccess: () => mockAccess,
}));

describe("AuthNavigationGate", () => {
	let animationFrames: FrameRequestCallback[];

	beforeEach(() => {
		mockReplace.mockReset();
		mockPush.mockReset();
		mockRetryAccess.mockClear();
		mockReloadApp.mockReset();
		mockAccess.isVerificationRequired = false;
		mockRouterState.pathname = "/";
		mockRouterState.rootNavigationState = { key: "root" };
		mockSession.isSessionLoading = false;
		mockSession.onboardingCompletionStatus = "none";
		mockSession.pendingSessionTask = null;
		mockSession.user = { clerkId: "user_123" };
		mockAccess.access = { state: "paid" };
		mockAccess.isAccessLoading = false;
		animationFrames = [];
		global.requestAnimationFrame = (callback: FrameRequestCallback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		};
		global.cancelAnimationFrame = jest.fn();
	});

	test("a cold offline start offers a same-bundle restart when identity cannot load", async () => {
		jest.useFakeTimers();
		try {
			mockSession.user = null;
			mockSession.isSessionLoading = true;
			mockAccess.access = undefined;
			const screen = await render(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			expect(
				screen.queryByRole("button", { name: "App neu starten" }),
			).toBeNull();
			await act(async () => jest.advanceTimersByTime(10_000));
			expect(screen.getByText("Zugang online prüfen")).toBeOnTheScreen();
			expect(screen.queryByText("Lerninhalt")).toBeNull();
			expect(
				screen.queryByRole("button", { name: "Konto verwalten" }),
			).toBeNull();
			await fireEvent.press(
				screen.getByRole("button", { name: "App neu starten" }),
			);
			expect(mockReloadApp).toHaveBeenCalledTimes(1);
			expect(mockRetryAccess).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});

	test("a failed cold-start restart explains manual recovery and allows another attempt", async () => {
		jest.useFakeTimers();
		try {
			mockSession.user = null;
			mockSession.isSessionLoading = true;
			mockAccess.access = undefined;
			mockReloadApp.mockRejectedValueOnce(
				new Error("native reload unavailable"),
			);
			const screen = await render(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			await act(async () => jest.advanceTimersByTime(10_000));
			await fireEvent.press(
				screen.getByRole("button", { name: "App neu starten" }),
			);
			expect(screen.getByRole("alert")).toHaveTextContent(/Schließe Dayova/);
			expect(
				screen.getByRole("button", { name: "App neu starten" }),
			).not.toBeDisabled();
		} finally {
			jest.useRealTimers();
		}
	});

	test("a session restored before the timeout never shows the restart fallback", async () => {
		jest.useFakeTimers();
		try {
			mockSession.user = null;
			mockSession.isSessionLoading = true;
			const screen = await render(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			await act(async () => jest.advanceTimersByTime(5_000));
			mockSession.user = { clerkId: "user_123" };
			mockSession.isSessionLoading = false;
			mockRouterState.pathname = "/home";
			await screen.rerender(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			await act(async () => jest.advanceTimersByTime(10_000));
			expect(screen.getByText("Lerninhalt")).toBeOnTheScreen();
			expect(
				screen.queryByRole("button", { name: "App neu starten" }),
			).toBeNull();
		} finally {
			jest.useRealTimers();
		}
	});

	test.each([
		"before",
		"after",
	] as const)("restart failure %s identity restoration does not leak into access verification", async (failureTiming) => {
		jest.useFakeTimers();
		try {
			mockSession.user = null;
			mockSession.isSessionLoading = true;
			mockAccess.access = undefined;
			let rejectReload: (error: Error) => void = () => {
				throw new Error("Reload was not dispatched");
			};
			mockReloadApp.mockImplementationOnce(
				() =>
					new Promise<void>((_resolve, reject) => {
						rejectReload = reject;
						if (failureTiming === "before")
							reject(new Error("native reload unavailable"));
					}),
			);
			const screen = await render(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			await act(async () => jest.advanceTimersByTime(10_000));
			await fireEvent.press(
				screen.getByRole("button", { name: "App neu starten" }),
			);
			if (failureTiming === "before")
				expect(screen.getByRole("alert")).toHaveTextContent(/Schließe Dayova/);
			mockSession.user = { clerkId: "user_123" };
			mockSession.isSessionLoading = false;
			mockRouterState.pathname = "/home";
			mockAccess.isAccessLoading = true;
			mockAccess.isVerificationRequired = true;
			await screen.rerender(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			if (failureTiming === "after")
				await act(async () => {
					rejectReload(new Error("late native failure"));
				});
			expect(screen.queryByRole("alert")).toBeNull();
			await fireEvent.press(
				screen.getByRole("button", { name: "Erneut prüfen" }),
			);
			expect(mockRetryAccess).toHaveBeenCalledTimes(1);
			expect(mockReloadApp).toHaveBeenCalledTimes(1);
		} finally {
			jest.useRealTimers();
		}
	});

	test("two immediate restart activations dispatch once and a hung restart can be retried", async () => {
		jest.useFakeTimers();
		try {
			mockSession.user = null;
			mockSession.isSessionLoading = true;
			mockAccess.access = undefined;
			const screen = await render(
				<AuthNavigationGate>
					<Text>Lerninhalt</Text>
				</AuthNavigationGate>,
			);
			await act(async () => jest.advanceTimersByTime(10_000));
			const button = screen.getByRole("button", { name: "App neu starten" });
			let repeatedPress: Promise<unknown> | undefined;
			mockReloadApp.mockImplementationOnce(() => {
				// Deliver the second press before the first handler can commit disabled state.
				// Nesting the events also keeps the testing library's act scopes ordered.
				repeatedPress = fireEvent.press(button);
				return new Promise<never>(() => {});
			});
			await fireEvent.press(button);
			expect(repeatedPress).toBeDefined();
			await repeatedPress;
			expect(mockReloadApp).toHaveBeenCalledTimes(1);
			await act(async () => jest.advanceTimersByTime(10_000));
			expect(screen.getByRole("alert")).toHaveTextContent(/Schließe Dayova/);
			expect(
				screen.getByRole("button", { name: "App neu starten" }),
			).not.toBeDisabled();
			await fireEvent.press(
				screen.getByRole("button", { name: "App neu starten" }),
			);
			expect(mockReloadApp).toHaveBeenCalledTimes(2);
			expect(
				screen.getByRole("button", { name: "Wird neu gestartet …" }),
			).toBeDisabled();
		} finally {
			jest.useRealTimers();
		}
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
	test("pending online verification offers retry and account recovery without claiming expiry", async () => {
		mockRouterState.pathname = "/home";
		mockAccess.access = undefined;
		mockAccess.isAccessLoading = true;
		mockAccess.isVerificationRequired = true;
		const screen = await render(
			<AuthNavigationGate>
				<Text>Lerninhalt</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByText("Zugang online prüfen")).toBeOnTheScreen();
		expect(screen.queryByText("Deine Testphase ist beendet")).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut prüfen" }),
		);
		expect(mockRetryAccess).toHaveBeenCalledTimes(1);
		await fireEvent.press(
			screen.getByRole("button", { name: "Konto verwalten" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/profile");
		mockRouterState.pathname = "/profile";
		await screen.rerender(
			<AuthNavigationGate>
				<Text>Konto</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByText("Konto")).toBeOnTheScreen();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
	});
	test.each([
		{ path: "/change-password", task: null },
		{ path: "/session-tasks/reset-password", task: "reset-password" },
		{ path: "/password-reset-success", task: null },
	])("online verification does not mask account recovery at $path", async ({
		path,
		task,
	}) => {
		mockRouterState.pathname = path;
		mockSession.pendingSessionTask = task;
		mockAccess.access = undefined;
		mockAccess.isAccessLoading = true;
		mockAccess.isVerificationRequired = true;
		const screen = await render(
			<AuthNavigationGate>
				<Text>Kontosicherheit</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByText("Kontosicherheit")).toBeOnTheScreen();
		expect(screen.queryByTestId("auth-bootstrap-mask")).toBeNull();
	});
	test("a failed manual verification retry gives actionable feedback and allows another attempt", async () => {
		mockRouterState.pathname = "/home";
		mockAccess.access = undefined;
		mockAccess.isAccessLoading = true;
		mockAccess.isVerificationRequired = true;
		mockRetryAccess.mockRejectedValueOnce(new Error("offline"));
		const screen = await render(
			<AuthNavigationGate>
				<Text>Inhalt</Text>
			</AuthNavigationGate>,
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut prüfen" }),
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			/Prüfe deine Internetverbindung/,
		);
		expect(
			screen.getByRole("button", { name: "Erneut prüfen" }),
		).not.toBeDisabled();
	});
	test("an unanswered verification retry times out without leaving the button busy forever", async () => {
		jest.useFakeTimers();
		try {
			mockRouterState.pathname = "/home";
			mockAccess.access = undefined;
			mockAccess.isAccessLoading = true;
			mockAccess.isVerificationRequired = true;
			mockRetryAccess.mockImplementationOnce(
				() => new Promise<never>(() => {}),
			);
			const screen = await render(
				<AuthNavigationGate>
					<Text>Inhalt</Text>
				</AuthNavigationGate>,
			);
			await fireEvent.press(
				screen.getByRole("button", { name: "Erneut prüfen" }),
			);
			expect(
				screen.getByRole("button", { name: "Wird geprüft …" }),
			).toBeDisabled();
			await act(async () => jest.advanceTimersByTime(10_000));
			expect(screen.getByRole("alert")).toHaveTextContent(
				/Prüfe deine Internetverbindung/,
			);
			expect(
				screen.getByRole("button", { name: "Erneut prüfen" }),
			).not.toBeDisabled();
		} finally {
			jest.useRealTimers();
		}
	});
	test.each([
		"/profile",
		"/subscription",
		"/change-password",
	])("trial consent handoff cannot block account recovery at %s", async (pathname) => {
		mockRouterState.pathname = pathname;
		mockSession.onboardingCompletionStatus = "ready_for_trial";
		mockAccess.access = { state: "needsActivation" };
		const screen = await render(
			<AuthNavigationGate>
				<Text>Vor Trial-Annahme erreichbar</Text>
			</AuthNavigationGate>,
		);
		expect(screen.getByText("Vor Trial-Annahme erreichbar")).toBeOnTheScreen();
		await act(flushAnimationFrames);
		expect(mockReplace).not.toHaveBeenCalled();
	});
});
