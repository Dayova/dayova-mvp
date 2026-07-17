import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { LoginScreen } from "./dayova-auth-flow";

const mockLogin = jest.fn();
const mockCancelPasswordReset = jest.fn<() => Promise<void>>(
	async () => undefined,
);
const mockResendPasswordResetCode = jest.fn<
	(stage: "reset_code" | "second_factor") => Promise<void>
>(async () => undefined);
const mockStartPasswordReset = jest.fn<(email: string) => Promise<void>>(
	async () => undefined,
);
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
		router: mockRouter,
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
		completePasswordReset: jest.fn(),
		isLoading: false,
		login: mockLogin,
		pendingVerification: null,
		resendPasswordResetCode: mockResendPasswordResetCode,
		resendVerification: jest.fn(),
		startPasswordReset: mockStartPasswordReset,
		verifyEmailCode: jest.fn(),
		verifyPasswordResetCode: jest.fn(),
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
		mockResendPasswordResetCode.mockReset();
		mockResendPasswordResetCode.mockResolvedValue(undefined);
		mockRouter.replace.mockReset();
		mockStartPasswordReset.mockReset();
		mockStartPasswordReset.mockResolvedValue(undefined);
	});

	test("uses persistent native sign-in without a remember-me choice", async () => {
		const screen = await render(<LoginScreen />);

		expect(screen.queryByText("Angemeldet bleiben")).toBeNull();
		expect(screen.getByText("Passwort vergessen?")).toBeOnTheScreen();
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
		await fireEvent.press(screen.getByText("Code erneut senden"));

		await screen.findByText(
			"Falls ein Konto existiert, haben wir einen neuen Code per E-Mail gesendet.",
		);
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
});
