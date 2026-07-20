import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthChoiceScreen, LoginScreen } from "./dayova-auth-flow";

const mockLogin = jest.fn<
	(input: {
		email: string;
		password: string;
	}) => Promise<
		{ status: "complete" } | { status: "needs_verification"; message: string }
	>
>(async () => ({ status: "complete" }));
const mockCancelPasswordReset = jest.fn<() => Promise<void>>(
	async () => undefined,
);
const mockResendPasswordResetCode = jest.fn<
	(stage: "reset_code" | "second_factor") => Promise<void>
>(async () => undefined);
const mockStartPasswordReset = jest.fn<(email: string) => Promise<void>>(
	async () => undefined,
);
const mockVerifyPasswordResetCode = jest.fn<(code: string) => Promise<void>>(
	async () => undefined,
);
const mockCompletePasswordReset = jest.fn<
	(password: string) => Promise<{ status: "complete" | "needs_second_factor" }>
>(async () => ({ status: "complete" }));
const mockRouter = {
	back: jest.fn(),
	push: jest.fn(),
	replace: jest.fn(),
};

jest.mock("react-native-reanimated", () => {
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	const animationBuilder = {
		damping: () => animationBuilder,
		delay: () => animationBuilder,
		duration: () => animationBuilder,
		springify: () => animationBuilder,
	};
	return {
		__esModule: true,
		default: {
			createAnimatedComponent: <T,>(component: T) => component,
			Text: ReactNative.Text,
			View: ReactNative.View,
		},
		Easing: {
			inOut: (value: unknown) => value,
			linear: jest.fn(),
			quad: jest.fn(),
		},
		FadeIn: animationBuilder,
		FadeInDown: animationBuilder,
		FadeInUp: animationBuilder,
		interpolate: jest.fn(() => 0),
		LinearTransition: animationBuilder,
		useAnimatedProps: (factory: () => unknown) => factory(),
		useAnimatedScrollHandler: () => jest.fn(),
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
		useSharedValue: (value: unknown) => ({ value }),
		withRepeat: (value: unknown) => value,
		withSequence: (...values: unknown[]) => values.at(-1),
		withTiming: (value: unknown) => value,
	};
});

jest.mock("expo-router", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Stack = ({ children }: { children?: ReactNode }) =>
		React.createElement("Stack", null, children);
	Stack.Screen = () => null;

	return {
		Redirect: () => null,
		Stack,
		router: {
			back: (...args: never[]) => mockRouter.back(...args),
			push: (...args: [string]) => mockRouter.push(...args),
			replace: (...args: [string]) => mockRouter.replace(...args),
		},
		useRouter: () => mockRouter,
	};
});

jest.mock("expo-linear-gradient", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		LinearGradient: ({ children, ...props }: { children?: ReactNode }) =>
			React.createElement("LinearGradient", props, children),
	};
});

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 24, left: 0, right: 0, top: 24 }),
}));

jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: () => null,
}));

jest.mock("~/components/ui/keyboard-safe-scroll-view", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		KeyboardSafeScrollView: ({
			children,
			...props
		}: {
			children?: ReactNode;
		}) => React.createElement(ReactNative.ScrollView, props, children),
	};
});

jest.mock("~/components/ui/select-sheet", () => ({
	SelectSheet: () => null,
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy(
		{ __esModule: true },
		{
			get: (target, property) =>
				property in target ? target[property as keyof typeof target] : Icon,
		},
	);
});

jest.mock("~/context/AuthContext", () => ({
	useAuthFlow: () => ({
		cancelPasswordReset: mockCancelPasswordReset,
		completePasswordReset: mockCompletePasswordReset,
		isLoading: false,
		login: mockLogin,
		pendingVerification: null,
		resendPasswordResetCode: mockResendPasswordResetCode,
		resendVerification: jest.fn(),
		startPasswordReset: mockStartPasswordReset,
		verifyEmailCode: jest.fn(),
		verifyPasswordResetCode: mockVerifyPasswordResetCode,
		verifyPasswordResetSecondFactor: jest.fn(),
	}),
	useAuthSession: () => ({
		isConvexAuthenticated: false,
		isPostAuthSyncing: false,
		user: null,
	}),
}));

jest.mock("~/context/OnboardingContext", () => ({
	useOnboarding: () => ({
		answers: {},
		setAnswer: jest.fn(),
	}),
}));

jest.mock("~/lib/navigation", () => ({
	useBackIntent: jest.fn(),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			background: "#FFFFFF",
			destructive: "#D92D20",
			secondaryText: "#697586",
			surface: "#FFFFFF",
			text: "#1A1A1A",
		},
	}),
}));

describe("LoginScreen", () => {
	beforeEach(() => {
		mockCancelPasswordReset.mockReset();
		mockCancelPasswordReset.mockResolvedValue(undefined);
		mockLogin.mockReset();
		mockLogin.mockResolvedValue({ status: "complete" });
		mockResendPasswordResetCode.mockReset();
		mockResendPasswordResetCode.mockResolvedValue(undefined);
		mockRouter.replace.mockReset();
		mockRouter.push.mockReset();
		mockStartPasswordReset.mockReset();
		mockStartPasswordReset.mockResolvedValue(undefined);
		mockVerifyPasswordResetCode.mockReset();
		mockVerifyPasswordResetCode.mockResolvedValue(undefined);
		mockCompletePasswordReset.mockReset();
		mockCompletePasswordReset.mockResolvedValue({ status: "complete" });
	});

	test("uses persistent native sign-in without a remember-me choice", async () => {
		const screen = await render(<LoginScreen />);

		expect(screen.queryByText("Angemeldet bleiben")).toBeNull();
		expect(screen.getByText("Passwort vergessen?")).toBeOnTheScreen();
	});

	test("pushes registration so the native back gesture keeps its entry route", async () => {
		const screen = await render(<AuthChoiceScreen />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Registrierung" }),
		);

		expect(mockRouter.push).toHaveBeenCalledWith("/onboarding");
	});

	test("keeps password recovery reachable from sign-in", async () => {
		const screen = await render(<LoginScreen />);

		await fireEvent.press(screen.getByText("Passwort vergessen?"));

		expect(
			screen.getByText(
				"Gib deine E-Mail-Adresse ein. Falls ein Konto existiert, senden wir dir einen sechsstelligen Code.",
			),
		).toBeOnTheScreen();
	});

	test("exposes the login action as an accessible button", async () => {
		const screen = await render(<LoginScreen />);

		expect(screen.getByRole("button", { name: "LOGIN" })).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Passwort anzeigen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Jetzt registrieren" }),
		).toBeOnTheScreen();
	});

	test("announces sign-in errors and associates fields with meaningful labels", async () => {
		mockLogin.mockRejectedValueOnce(new Error("Anmeldung fehlgeschlagen"));
		const screen = await render(<LoginScreen />);

		await fireEvent.changeText(
			screen.getByLabelText("E-Mail-Adresse"),
			"learner@example.de",
		);
		await fireEvent.changeText(screen.getByLabelText("Passwort"), "falsch123");
		await fireEvent.press(screen.getByRole("button", { name: "LOGIN" }));

		const error = await screen.findByRole("alert");
		expect(error.props.accessibilityLiveRegion).toBe("polite");
	});

	test("submits the exact sign-in password without trimming valid characters", async () => {
		const screen = await render(<LoginScreen />);
		const exactPassword = " sicher123 ";

		await fireEvent.changeText(
			screen.getByLabelText("E-Mail-Adresse"),
			"learner@example.de",
		);
		await fireEvent.changeText(
			screen.getByLabelText("Passwort"),
			exactPassword,
		);
		await fireEvent.press(screen.getByRole("button", { name: "LOGIN" }));

		await waitFor(() => {
			expect(mockLogin).toHaveBeenCalledWith({
				email: "learner@example.de",
				password: exactPassword,
			});
		});
	});

	test("leaves completed-session navigation to the root auth guard", async () => {
		const screen = await render(<LoginScreen />);

		await fireEvent.changeText(
			screen.getByLabelText("E-Mail-Adresse"),
			"learner@example.de",
		);
		await fireEvent.changeText(screen.getByLabelText("Passwort"), "sicher123");
		await fireEvent.press(screen.getByRole("button", { name: "LOGIN" }));

		await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});

	test("keeps reset and resend confirmation neutral", async () => {
		const screen = await render(<LoginScreen />);

		await fireEvent.press(screen.getByText("Passwort vergessen?"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("max.mustermann@gmail.com"),
			"unknown@example.de",
		);
		await fireEvent.press(screen.getByRole("button", { name: "CODE SENDEN" }));

		await screen.findByText(
			"Falls ein Konto für unknown@example.de existiert, haben wir einen sechsstelligen Code gesendet.",
		);
		expect(screen.getByLabelText("Bestätigungscode")).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Code erneut senden" }),
		);

		const resendNotice = await screen.findByText(
			"Falls ein Konto existiert, haben wir einen neuen Code per E-Mail gesendet.",
		);
		expect(resendNotice.props.accessibilityLiveRegion).toBe("polite");
		expect(mockResendPasswordResetCode).toHaveBeenCalledWith("reset_code");
	});

	test("waits for reset cancellation before returning to the email stage", async () => {
		let resolveCancellation: () => void = () => undefined;
		mockCancelPasswordReset.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					resolveCancellation = resolve;
				}),
		);
		const screen = await render(<LoginScreen />);

		await fireEvent.press(screen.getByText("Passwort vergessen?"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("max.mustermann@gmail.com"),
			"learner@example.de",
		);
		await fireEvent.press(screen.getByRole("button", { name: "CODE SENDEN" }));
		await screen.findByText("Prüfe deine E-Mail");

		await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
		expect(screen.getByText("Prüfe deine E-Mail")).toBeOnTheScreen();

		await act(async () => resolveCancellation());
		await waitFor(() => {
			expect(screen.getByText("Passwort vergessen?")).toBeOnTheScreen();
		});
	});

	test("submits the exact new password without trimming valid characters", async () => {
		const screen = await render(<LoginScreen />);

		await fireEvent.press(screen.getByText("Passwort vergessen?"));
		await fireEvent.changeText(
			screen.getByLabelText("E-Mail-Adresse"),
			"learner@example.de",
		);
		await fireEvent.press(screen.getByRole("button", { name: "CODE SENDEN" }));
		await fireEvent.changeText(
			screen.getByLabelText("Bestätigungscode"),
			"123456",
		);
		await screen.findByRole("header", { name: "Neues Passwort" });

		const exactPassword = " sicher123 ";
		await fireEvent.changeText(
			screen.getByLabelText("Neues Passwort"),
			exactPassword,
		);
		await fireEvent.changeText(
			screen.getByLabelText("Neues Passwort wiederholen"),
			exactPassword,
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "PASSWORT SPEICHERN" }),
		);

		await waitFor(() => {
			expect(mockCompletePasswordReset).toHaveBeenCalledWith(exactPassword);
		});
	});
});
