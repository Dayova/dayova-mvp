import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import {
	AuthChoiceScreen,
	CreationLoaderScreen,
	LoginScreen,
	OnboardingScreen,
} from "./dayova-auth-flow";

const mockLogin = jest.fn<
	(input: {
		email: string;
		password: string;
	}) => Promise<
		{ status: "complete" } | { status: "needs_verification"; message: string }
	>
>(async () => ({ status: "complete" }));
const mockRegister = jest.fn<
	(input: {
		birthDate: string;
		email: string;
		grade: string;
		name: string;
		password: string;
		schoolType?: string;
		state: string;
	}) => Promise<{ status: "needs_verification"; message: string }>
>(async () => ({
	status: "needs_verification",
	message: "Bestätige deine E-Mail-Adresse.",
}));
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
const mockSetOnboardingAnswer = jest.fn();
const mockOnboarding = {
	answers: {
		studyTime: "30 min",
		strength: "Mathe",
		challenge: "Organisation",
		goal: "Mehr Struktur im Lernen",
		state: "Sachsen",
		schoolType: "prefer_not_to_say",
		grade: "9",
		dailySchoolTime: "60 min",
		studyDays: "Montag",
		learningTime: "16:30",
		name: "Test User",
		email: "test@example.com",
		birthDate: "09.09.2012",
		password: "sicher123",
	},
	hasAnswers: false,
	setAnswer: mockSetOnboardingAnswer,
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

jest.mock("~/components/ui/date-time-picker-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		DateTimePickerSheet: ({ onClose }: { onClose: () => void }) =>
			React.createElement(ReactNative.Pressable, {
				accessibilityLabel: "Testauswahl schließen",
				accessibilityRole: "button",
				onPress: onClose,
			}),
	};
});

jest.mock("~/components/ui/animated-flower-loader", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		AnimatedFlowerLoader: () =>
			React.createElement("AnimatedFlowerLoader", null),
	};
});

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
		register: mockRegister,
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
	useOnboarding: () => mockOnboarding,
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
		const passwordRecoveryButton = screen.getByRole("button", {
			name: "Passwort vergessen",
		});

		expect(passwordRecoveryButton.props.className).toContain("min-h-11");
		expect(passwordRecoveryButton.props.accessibilityHint).toBe(
			"Öffnet den Ablauf zum Zurücksetzen deines Passworts",
		);

		await fireEvent.press(passwordRecoveryButton);

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

describe("CreationLoaderScreen", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockRouter.replace.mockReset();
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	test("confirms account setup before continuing to trial activation", async () => {
		const screen = await render(
			<CreationLoaderScreen
				topInset={24}
				bottomInset={24}
				isComplete={false}
			/>,
		);

		expect(
			screen.getByText("Dein Konto wird\nfür dich eingerichtet."),
		).toBeOnTheScreen();

		await screen.rerender(
			<CreationLoaderScreen topInset={24} bottomInset={24} isComplete={true} />,
		);

		expect(
			screen.getByText(
				"Alles bereit.\nStarte jetzt mit deiner ersten Prüfung.",
			),
		).toBeOnTheScreen();

		await act(async () => {
			jest.advanceTimersByTime(1799);
		});
		expect(mockRouter.replace).not.toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(1);
		});
		expect(mockRouter.replace).toHaveBeenCalledWith("/trial");
	});
});

describe("OnboardingScreen", () => {
	beforeEach(() => {
		mockRegister.mockReset();
		mockRegister.mockResolvedValue({
			status: "needs_verification",
			message: "Bestätige deine E-Mail-Adresse.",
		});
		mockRouter.replace.mockReset();
		mockSetOnboardingAnswer.mockReset();
		mockOnboarding.answers.state = "Sachsen";
		mockOnboarding.answers.schoolType = "prefer_not_to_say";
		mockOnboarding.answers.grade = "9";
		mockOnboarding.answers.birthDate = "09.09.2012";
	});

	test("opens with the exact-exam promise and shows compact profile progress", async () => {
		const screen = await render(<OnboardingScreen />);

		expect(
			screen.getByRole("header", {
				name: "Deine Prüfung. Dein nächster Schritt.",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByText("7 kurze Schritte · dauert etwa 1 Minute"),
		).toBeOnTheScreen();
		expect(
			screen.queryByText("Wie viel lernst du aktuell pro Tag?"),
		).toBeNull();

		await fireEvent.press(
			screen.getByRole("button", { name: "Profil einrichten" }),
		);

		expect(
			await screen.findByRole("header", {
				name: "Wie dürfen wir dich nennen?",
			}),
		).toBeOnTheScreen();
		expect(screen.getByText("1 von 7")).toBeOnTheScreen();
	});

	test("does not preselect a grade and requires an explicit choice", async () => {
		mockOnboarding.answers.grade = "";
		const screen = await render(<OnboardingScreen initialStepId="grade" />);

		expect(screen.getByText("Klassenstufe auswählen")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));

		expect(
			await screen.findByRole("alert", {
				name: "Bitte wähle eine Antwort aus.",
			}),
		).toBeOnTheScreen();
	});

	test("renders school type through the shared bottom-sheet select trigger", async () => {
		mockOnboarding.answers.schoolType = "";
		const screen = await render(
			<OnboardingScreen initialStepId="schoolType" />,
		);

		expect(screen.getByText("Welche Schulart besuchst du?")).toBeOnTheScreen();
		expect(screen.getByText("Schulart auswählen")).toBeOnTheScreen();
		expect(
			screen.getByTestId("onboarding-school-type-picker"),
		).toBeOnTheScreen();
	});

	test("keeps date of birth visibly empty until the learner chooses it", async () => {
		mockOnboarding.answers.birthDate = "";
		const screen = await render(<OnboardingScreen initialStepId="birthDate" />);

		expect(screen.getByText("Geburtsdatum auswählen")).toBeOnTheScreen();
		expect(screen.queryByText("09.09.2012")).toBeNull();

		await fireEvent.press(
			screen.getByRole("button", { name: "Geburtsdatum auswählen" }),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Testauswahl schließen" }),
		);
		const expectedDefaultBirthDate = `09.09.${new Date().getFullYear() - 14}`;
		expect(mockSetOnboardingAnswer).toHaveBeenCalledWith(
			"birthDate",
			expectedDefaultBirthDate,
		);
	});

	test("keeps verification progress aligned with the profile steps", async () => {
		const screen = await render(<OnboardingScreen initialStepId="password" />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Konto erstellen" }),
		);
		expect(
			await screen.findByRole("header", { name: "E-Mail bestätigen" }),
		).toBeOnTheScreen();

		expect(
			screen.getByTestId("onboarding-verification-scroll").props
				.contentInsetAdjustmentBehavior,
		).toBe("never");
	});
});
