import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import {
	act,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { OnboardingCompletionStatus } from "~/lib/auth-routing";
import {
	AuthChoiceScreen,
	CreationLoaderScreen,
	LoginScreen,
	OnboardingRecoveryScreen,
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
const mockStartRegistrationWithEmail = jest.fn<
	(email: string) => Promise<void>
>(async () => undefined);
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
	canGoBack: jest.fn(() => true),
	push: jest.fn(),
	replace: jest.fn(),
};
const mockStackScreens: Array<Record<string, unknown>> = [];
const mockRetryPostAuthSync = jest.fn();
const mockCompleteOnboardingHandoff = jest.fn(async () => true);
const mockStageOnboardingRecovery = jest.fn(async () => undefined);
const mockAuthSession = {
	completeOnboardingHandoff: mockCompleteOnboardingHandoff,
	isConvexAuthenticated: false,
	isPostAuthSyncing: false,
	onboardingCompletionStatus: "none" as OnboardingCompletionStatus,
	postAuthSyncError: null as string | null,
	retryPostAuthSync: mockRetryPostAuthSync,
	user: null as { clerkId: string; email: string } | null,
};
const mockSetOnboardingAnswer = jest.fn();
const mockOnboarding = {
	answers: {
		studyTime: "30",
		studyDays: "Montag, Donnerstag, Samstag",
		learningTime: "16:30",
		state: "Sachsen",
		schoolType: "prefer_not_to_say",
		grade: "9",
		name: "Test User",
		email: "test@example.com",
		birthYear: "2012",
		birthMonth: "09",
		birthDay: "09",
		password: "sicher123",
	},
	hasAnswers: false,
	setAnswer: mockSetOnboardingAnswer,
};

let mockWindowDimensions = {
	fontScale: 1,
	height: 844,
	scale: 3,
	width: 390,
};
let mockReducedMotion = false;

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
	__esModule: true,
	default: () => mockWindowDimensions,
}));

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
			FlatList: ReactNative.FlatList,
			Text: ReactNative.Text,
			View: ReactNative.View,
		},
		Easing: {
			cubic: jest.fn(),
			inOut: (value: unknown) => value,
			linear: jest.fn(),
			out: (value: unknown) => value,
			quad: jest.fn(),
		},
		FadeIn: animationBuilder,
		FadeInDown: animationBuilder,
		FadeInUp: animationBuilder,
		interpolate: jest.fn(() => 0),
		interpolateColor: (value: number, _input: number[], output: string[]) =>
			value >= 1 ? output.at(-1) : output[0],
		LinearTransition: animationBuilder,
		useAnimatedProps: (factory: () => unknown) => factory(),
		useAnimatedScrollHandler: (handlers: {
			onScroll: (event: { contentOffset: { x: number } }) => void;
		}) => handlers.onScroll,
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
		useReducedMotion: () => mockReducedMotion,
		useSharedValue: (initialValue: unknown) => {
			let value = initialValue;
			return {
				get: () => value,
				set: (nextValue: unknown) => {
					value = nextValue;
				},
				value,
			};
		},
		withRepeat: (value: unknown) => value,
		withSequence: (...values: unknown[]) => values.at(-1),
		withTiming: (value: unknown) => value,
	};
});

jest.mock("react-native-worklets", () => ({
	scheduleOnRN: (
		callback: (...args: unknown[]) => unknown,
		...args: unknown[]
	) => callback(...args),
}));

jest.mock("react-native-gesture-handler", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const createGesture = () => {
		const gesture = new Proxy(
			{},
			{
				get:
					() =>
					(..._args: unknown[]) =>
						gesture,
			},
		);
		return gesture;
	};

	return {
		Gesture: { Pan: createGesture },
		GestureDetector: ({ children }: { children?: ReactNode }) =>
			React.createElement("GestureDetector", null, children),
	};
});

jest.mock("expo-router", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Stack = ({ children }: { children?: ReactNode }) =>
		React.createElement("Stack", null, children);
	Stack.Screen = (props: Record<string, unknown>) => {
		mockStackScreens.push(props);
		return null;
	};

	return {
		Redirect: () => null,
		Stack,
		router: {
			back: (...args: never[]) => mockRouter.back(...args),
			canGoBack: () => mockRouter.canGoBack(),
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

jest.mock("~/components/intro-upload-artwork", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		IntroUploadArtwork: () => React.createElement("IntroUploadArtwork"),
	};
});

jest.mock("~/components/onboarding/intro-plan-artwork", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		IntroPlanArtwork: () =>
			React.createElement("IntroPlanArtwork", {
				testID: "intro-plan-artwork",
			}),
	};
});

jest.mock("~/components/onboarding/intro-tasks-artwork", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		IntroTasksArtwork: () => React.createElement("IntroTasksArtwork"),
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
		DateTimePickerSheet: ({
			visible,
			value,
			onChange,
			onClose,
			onConfirm,
		}: {
			visible: boolean;
			value: Date;
			onChange: (event: { type: "set" }, date: Date) => void;
			onClose: () => void;
			onConfirm?: (date: Date) => void;
		}) =>
			visible
				? React.createElement(
						ReactNative.View,
						null,
						React.createElement(ReactNative.Pressable, {
							accessibilityLabel: "Testzeit 18:05 auswählen",
							accessibilityRole: "button",
							onPress: () =>
								onChange({ type: "set" }, new Date(2026, 0, 1, 18, 5, 0, 0)),
						}),
						React.createElement(ReactNative.Pressable, {
							accessibilityLabel: "Testauswahl schließen",
							accessibilityRole: "button",
							onPress: onClose,
						}),
						React.createElement(ReactNative.Pressable, {
							accessibilityLabel: "Testauswahl bestätigen",
							accessibilityRole: "button",
							onPress: () => onConfirm?.(value),
						}),
					)
				: null,
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
	useAuthFlow: () => {
		const React = jest.requireActual<typeof import("react")>("react");
		const [isLoading, setIsLoading] = React.useState(false);

		return {
			cancelPasswordReset: mockCancelPasswordReset,
			startRegistrationWithEmail: async (email: string) => {
				setIsLoading(true);
				try {
					await mockStartRegistrationWithEmail(email);
				} finally {
					setIsLoading(false);
				}
			},
			completePasswordReset: mockCompletePasswordReset,
			isLoading,
			login: mockLogin,
			pendingVerification: null,
			register: mockRegister,
			stageOnboardingRecovery: mockStageOnboardingRecovery,
			replaceOnboardingRecoveryAnswers: jest.fn(async () => undefined),
			resendPasswordResetCode: mockResendPasswordResetCode,
			resendVerification: jest.fn(),
			startPasswordReset: mockStartPasswordReset,
			verifyEmailCode: jest.fn(),
			verifyPasswordResetCode: mockVerifyPasswordResetCode,
			verifyPasswordResetSecondFactor: jest.fn(),
		};
	},
	useAuthSession: () => ({
		...mockAuthSession,
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
			border: "#DCE6EE",
			destructive: "#D92D20",
			path2: "#D7DCE3",
			path1: "#D7DCE3",
			primary: "#00BAFF",
			onPrimary: "#FFFFFF",
			secondaryText: "#697586",
			surface: "#FFFFFF",
			systemSubtle: "#F1F7FB",
			text: "#1A1A1A",
		},
	}),
}));

describe("LoginScreen", () => {
	beforeEach(() => {
		mockReducedMotion = false;
		mockWindowDimensions = {
			fontScale: 1,
			height: 844,
			scale: 3,
			width: 390,
		};
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

	test("removes the large-text auth entrance animation when reduced motion is enabled", async () => {
		mockReducedMotion = true;
		mockWindowDimensions = {
			fontScale: 3,
			height: 667,
			scale: 2,
			width: 375,
		};
		const screen = await render(<AuthChoiceScreen />);

		expect(
			screen.getByTestId("auth-choice-logo-card").props.entering,
		).toBeUndefined();
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

	test("requires an explicit handoff to trial activation", async () => {
		const complete = jest.fn(async () => undefined);
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
			<CreationLoaderScreen
				topInset={24}
				bottomInset={24}
				isComplete={true}
				onComplete={complete}
			/>,
		);

		expect(
			screen.getByText(
				"Dein Konto ist bereit.\nAls Nächstes startest du deine Testphase.",
			),
		).toBeOnTheScreen();

		await act(async () => {
			jest.advanceTimersByTime(10_000);
		});
		expect(mockRouter.replace).not.toHaveBeenCalled();

		await fireEvent.press(
			screen.getByRole("button", { name: "Weiter zur Testphase" }),
		);
		expect(complete).toHaveBeenCalledTimes(1);
		expect(mockRouter.replace).not.toHaveBeenCalled();
	});

	test("turns a failed post-auth sync into a visible retry path", async () => {
		const retry = jest.fn();
		const screen = await render(
			<CreationLoaderScreen
				topInset={24}
				bottomInset={24}
				isComplete={false}
				error="Deine Angaben konnten noch nicht gespeichert werden."
				onRetry={retry}
			/>,
		);

		expect(
			screen.getByRole("alert", {
				name: "Deine Angaben konnten noch nicht gespeichert werden.",
			}),
		).toBeOnTheScreen();
		const error = screen.getByRole("alert");
		expect(error).toHaveProp("accessibilityLiveRegion", "polite");
		expect(error).toHaveProp("selectable", true);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		expect(retry).toHaveBeenCalledTimes(1);
	});
});

describe("OnboardingRecoveryScreen", () => {
	beforeEach(() => {
		mockReducedMotion = false;
		mockWindowDimensions = {
			fontScale: 1,
			height: 844,
			scale: 3,
			width: 390,
		};
	});

	test("collects only the operational learning-time answers after a lost payload", async () => {
		const change = jest.fn();
		const submit = jest.fn(async () => undefined);
		const screen = await render(
			<OnboardingRecoveryScreen
				topInset={24}
				bottomInset={24}
				answers={{
					studyTime: "30",
					studyDays: "Montag",
					learningTime: "16:00",
				}}
				error={null}
				onChange={change}
				onSubmit={submit}
			/>,
		);

		expect(
			screen.getByRole("header", {
				name: "Stelle deine Lernzeiten wieder her.",
			}),
		).toBeOnTheScreen();
		expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
		expect(screen.queryByLabelText("Passwort")).toBeNull();

		await fireEvent.press(screen.getByRole("checkbox", { name: "Dienstag" }));
		expect(change).toHaveBeenCalledWith("studyDays", "Montag, Dienstag");

		await act(() =>
			fireEvent.press(
				screen.getByRole("button", {
					name: "Lernzeit beginnt um 16:00 Uhr",
				}),
			),
		);
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Testzeit 18:05 auswählen" }),
			),
		);
		await act(() =>
			fireEvent.press(
				screen.getByRole("button", { name: "Testauswahl bestätigen" }),
			),
		);
		expect(change).toHaveBeenCalledWith("learningTime", "18:05");

		await fireEvent.press(
			screen.getByRole("button", { name: "Lernzeiten erneut speichern" }),
		);
		expect(submit).toHaveBeenCalledTimes(1);
	});

	test("keeps recovery submission disabled until all operational answers are explicit", async () => {
		const submit = jest.fn(async () => undefined);
		const screen = await render(
			<OnboardingRecoveryScreen
				topInset={24}
				bottomInset={24}
				answers={{ studyTime: "", studyDays: "", learningTime: "" }}
				error={null}
				onChange={jest.fn()}
				onSubmit={submit}
			/>,
		);

		const button = screen.getByRole("button", {
			name: "Lernzeiten erneut speichern",
		});
		expect(button).toBeDisabled();
		expect(
			screen.getByRole("alert", {
				name: "Bitte wähle deine Lerndauer aus.",
			}),
		).toBeOnTheScreen();
		await fireEvent.press(button);
		expect(submit).not.toHaveBeenCalled();
	});

	test("disables recovery controls while the durable payload is being replaced", async () => {
		const screen = await render(
			<OnboardingRecoveryScreen
				topInset={24}
				bottomInset={24}
				answers={{
					studyTime: "30",
					studyDays: "Montag",
					learningTime: "16:00",
				}}
				error={null}
				isSubmitting
				onChange={jest.fn()}
				onSubmit={jest.fn<() => void>()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Lernzeiten werden gespeichert" }),
		).toBeDisabled();
		expect(screen.getByRole("radio", { name: "30 Minuten" })).toBeDisabled();
		expect(screen.getByRole("checkbox", { name: "Montag" })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Lernzeit beginnt um 16:00 Uhr" }),
		).toBeDisabled();
	});
});

describe("OnboardingScreen", () => {
	beforeEach(() => {
		mockReducedMotion = false;
		mockWindowDimensions = {
			fontScale: 1,
			height: 844,
			scale: 3,
			width: 390,
		};
		mockStartRegistrationWithEmail.mockReset();
		mockStartRegistrationWithEmail.mockResolvedValue(undefined);
		mockRegister.mockReset();
		mockRegister.mockResolvedValue({
			status: "needs_verification",
			message: "Bestätige deine E-Mail-Adresse.",
		});
		mockRouter.replace.mockReset();
		mockRouter.canGoBack.mockReset();
		mockRouter.canGoBack.mockReturnValue(true);
		mockSetOnboardingAnswer.mockReset();
		mockRetryPostAuthSync.mockReset();
		mockCompleteOnboardingHandoff.mockReset();
		mockCompleteOnboardingHandoff.mockResolvedValue(true);
		mockStageOnboardingRecovery.mockReset();
		mockStageOnboardingRecovery.mockResolvedValue(undefined);
		mockAuthSession.isConvexAuthenticated = false;
		mockAuthSession.isPostAuthSyncing = false;
		mockAuthSession.postAuthSyncError = null;
		mockAuthSession.onboardingCompletionStatus = "none";
		mockAuthSession.user = null;
		mockOnboarding.answers.studyTime = "30";
		mockOnboarding.answers.studyDays = "Montag, Donnerstag, Samstag";
		mockOnboarding.answers.learningTime = "16:30";
		mockOnboarding.answers.state = "Sachsen";
		mockOnboarding.answers.schoolType = "prefer_not_to_say";
		mockOnboarding.answers.grade = "9";
		mockOnboarding.answers.birthYear = "2012";
		mockOnboarding.answers.birthMonth = "09";
		mockOnboarding.answers.birthDay = "09";
		mockOnboarding.answers.email = "test@example.com";
		mockStackScreens.length = 0;
	});

	test("enables route and interactive edge back only on the onboarding entry step", async () => {
		const screen = await render(<OnboardingScreen />);

		expect(mockStackScreens.at(-1)?.options).toMatchObject({
			gestureEnabled: true,
			fullScreenGestureEnabled: false,
		});
		expect(screen.getByTestId("onboarding-ios-edge-back")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));

		expect(mockStackScreens.at(-1)?.options).toMatchObject({
			gestureEnabled: false,
			fullScreenGestureEnabled: false,
		});
		expect(screen.queryByTestId("onboarding-ios-edge-back")).toBeNull();
	});

	test("teaches the product in three pages before personalized questions", async () => {
		const screen = await render(<OnboardingScreen />);

		expect(
			screen.getByRole("header", {
				name: "Du weißt, was heute wirklich zählt.",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Danach 14 kurze, bewusste Schritte · etwa 3 Minuten"),
		).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Meinen Start personalisieren" }),
		);

		expect(
			await screen.findByRole("header", {
				name: "Wie dürfen wir dich nennen?",
			}),
		).toBeOnTheScreen();
		expect(screen.getByText("1 von 14")).toBeOnTheScreen();
	});

	test("reflows the intro into a vertical scroll at accessibility text sizes", async () => {
		mockWindowDimensions = {
			fontScale: 3,
			height: 667,
			scale: 2,
			width: 375,
		};
		const screen = await render(<OnboardingScreen />);

		expect(screen.getByTestId("intro-responsive-scroll")).toBeOnTheScreen();
		expect(screen.queryByTestId("intro-pager")).toBeNull();
		expect(
			screen.getByRole("header", {
				name: "Du weißt, was heute wirklich zählt.",
			}),
		).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeOnTheScreen();
	});

	test("keeps scaled question content and its primary action in one scroll flow", async () => {
		mockWindowDimensions = {
			fontScale: 3,
			height: 667,
			scale: 2,
			width: 375,
		};
		const screen = await render(<OnboardingScreen initialStepId="studyTime" />);

		const questionScroll = screen.getByTestId("onboarding-question-scroll");
		expect(
			within(questionScroll).getByRole("button", { name: "Weiter" }),
		).toBeOnTheScreen();
		expect(
			screen.getByTestId("onboarding-progress-metadata").props.className,
		).toContain("flex-col");
	});

	test("keeps the progress bar mounted while advancing between profile steps", async () => {
		const screen = await render(<OnboardingScreen />);

		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(
			screen.getByRole("button", { name: "Meinen Start personalisieren" }),
		);

		const firstStepProgressBar = screen.getByRole("progressbar");
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));

		expect(screen.getByText("2 von 14")).toBeOnTheScreen();
		expect(screen.getByRole("progressbar")).toBe(firstStepProgressBar);
	});

	test("keeps intro indicators coupled to live pager scroll progress", async () => {
		const screen = await render(<OnboardingScreen />);
		const pager = screen.getByTestId("intro-pager");

		expect(pager.props.onScroll).toEqual(expect.any(Function));
		expect(pager.props.onScrollEndDrag).toEqual(expect.any(Function));
		expect(pager.props.scrollEventThrottle).toBe(16);
		expect(screen.getByTestId("intro-indicator-0")).toHaveStyle({
			backgroundColor: "#00BAFF",
			width: 30,
		});
		expect(screen.getByTestId("intro-indicator-1")).toHaveStyle({
			backgroundColor: "#DCE6EE",
			width: 8,
		});
		expect(screen.getByRole("progressbar")).toHaveProp("accessibilityValue", {
			min: 1,
			max: 3,
			now: 1,
			text: "Seite 1 von 3",
		});
	});

	test("surfaces an unexpected trial-handoff rejection as an actionable error", async () => {
		mockAuthSession.user = {
			clerkId: "user_123",
			email: "test@example.com",
		};
		mockAuthSession.isConvexAuthenticated = true;
		mockAuthSession.onboardingCompletionStatus = "ready_for_trial";
		mockCompleteOnboardingHandoff.mockRejectedValueOnce(
			new Error("secure storage unavailable"),
		);
		const screen = await render(<OnboardingScreen />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Weiter zur Testphase" }),
		);

		expect(
			await screen.findByRole("alert", {
				name: "Der Wechsel zur Testphase ist fehlgeschlagen. Bitte versuche es erneut.",
			}),
		).toBeOnTheScreen();
	});

	test("prevents parallel trial-handoff writes after repeated presses", async () => {
		let finishHandoff!: (value: boolean) => void;
		mockAuthSession.user = {
			clerkId: "user_123",
			email: "test@example.com",
		};
		mockAuthSession.isConvexAuthenticated = true;
		mockAuthSession.onboardingCompletionStatus = "ready_for_trial";
		mockCompleteOnboardingHandoff.mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					finishHandoff = resolve;
				}),
		);
		const screen = await render(<OnboardingScreen />);
		const continueButton = screen.getByRole("button", {
			name: "Weiter zur Testphase",
		});

		await fireEvent.press(continueButton);
		await fireEvent.press(continueButton);

		expect(mockCompleteOnboardingHandoff).toHaveBeenCalledTimes(1);
		const busyButton = await screen.findByRole("button", {
			name: "Testphase wird geöffnet",
		});
		expect(busyButton.props.accessibilityState).toMatchObject({
			busy: true,
			disabled: true,
		});

		await act(async () => finishHandoff(true));

		await waitFor(() =>
			expect(mockRouter.replace).toHaveBeenCalledWith("/trial"),
		);
	});

	test("keeps every intro page mounted for direct reduced-motion page changes", async () => {
		const screen = await render(<OnboardingScreen />);
		const pager = screen.getByTestId("intro-pager");

		expect(pager).toHaveProp("initialNumToRender", 3);
		expect(pager).toHaveProp("maxToRenderPerBatch", 3);
		expect(pager).toHaveProp("removeClippedSubviews", false);
	});

	test("renders the maintained learning-plan preview on the final intro page", async () => {
		const screen = await render(<OnboardingScreen />);

		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));

		expect(screen.getByTestId("intro-plan-artwork")).toBeOnTheScreen();
	});

	test("does not preselect a grade and disables continuation until it is valid", async () => {
		mockOnboarding.answers.grade = "";
		const screen = await render(<OnboardingScreen initialStepId="grade" />);

		expect(screen.getByText("Klassenstufe auswählen")).toBeOnTheScreen();
		expect(
			screen.getByText("Diese Angabe wird in deinem Schulprofil gespeichert."),
		).toBeOnTheScreen();
		const answerGroup = screen.getByTestId("onboarding-answer-group");
		const errorSlot = within(answerGroup).getByTestId(
			"onboarding-answer-error-slot",
		);
		expect(errorSlot).toHaveProp("className", "mt-3 min-h-8 px-3");
		expect(within(errorSlot).queryByRole("alert")).toBeNull();

		expect(
			screen.getByRole("button", { name: "Weiter" }).props.accessibilityState,
		).toMatchObject({ disabled: true });

		await act(async () => {
			mockOnboarding.answers = { ...mockOnboarding.answers, grade: "10" };
			screen.rerender(<OnboardingScreen initialStepId="grade" />);
		});
		await waitFor(() => {
			expect(within(errorSlot).queryByRole("alert")).toBeNull();
			expect(
				screen.getByRole("button", { name: "Weiter" }).props.accessibilityState,
			).toMatchObject({ disabled: false });
		});
	});

	test("uses a semantic high-contrast foreground on selected weekdays", async () => {
		mockOnboarding.answers.studyDays = "Montag";
		const screen = await render(<OnboardingScreen initialStepId="studyDays" />);

		expect(screen.getByText("Montag")).toHaveStyle({ color: "#FFFFFF" });
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

	test("shows the exact operational schedule before registration", async () => {
		const screen = await render(
			<OnboardingScreen initialStepId="learning-time-payoff" />,
		);

		expect(
			screen.getByRole("header", {
				name: "Test, deine Lernzeiten sind vorbereitet.",
			}),
		).toBeOnTheScreen();
		expect(screen.getByText("30 Minuten")).toBeOnTheScreen();
		expect(
			screen.getByText("Montag, Donnerstag und Samstag"),
		).toBeOnTheScreen();
		expect(screen.getByText("16:30–17:00 Uhr")).toBeOnTheScreen();
	});

	test("normalizes a recovered duration to the nearest supported option", async () => {
		mockOnboarding.answers.studyTime = "37";
		const screen = await render(<OnboardingScreen initialStepId="studyTime" />);

		expect(screen.getByText("30")).toBeOnTheScreen();
		expect(mockSetOnboardingAnswer).toHaveBeenCalledWith("studyTime", "30");
	});

	test("requires an explicit duration confirmation before continuing", async () => {
		mockOnboarding.answers.studyTime = "";
		const screen = await render(<OnboardingScreen initialStepId="studyTime" />);

		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
		expect(
			screen.getByRole("adjustable", { name: "Tägliche Lernzeit" }),
		).toHaveAccessibilityValue({
			text: "30 Minuten Vorschau, noch nicht ausgewählt",
		});
		await fireEvent.press(
			screen.getByRole("button", { name: "30 Minuten auswählen" }),
		);
		expect(mockSetOnboardingAnswer).toHaveBeenCalledWith("studyTime", "30");
	});

	test("collects real recurring weekdays with multi-select semantics", async () => {
		mockOnboarding.answers.studyDays = "";
		const screen = await render(<OnboardingScreen initialStepId="studyDays" />);

		const monday = screen.getByRole("checkbox", { name: "Montag" });
		expect(monday.props.accessibilityState).toEqual({ checked: false });
		expect(monday).toHaveStyle({
			backgroundColor: "#F1F7FB",
			borderColor: "#D7DCE3",
		});
		expect(screen.getByTestId("study-day-pill-check-slot-Montag")).toHaveProp(
			"className",
			"h-4 w-4 items-center justify-center",
		);
		expect(screen.getByTestId("study-day-pill-balance-slot-Montag")).toHaveProp(
			"className",
			"ml-2 h-4 w-4",
		);
		await fireEvent.press(monday);
		expect(mockSetOnboardingAnswer).toHaveBeenCalledWith("studyDays", "Montag");
	});

	test("collects the native start time instead of a decorative answer", async () => {
		mockOnboarding.answers.learningTime = "";
		const screen = await render(
			<OnboardingScreen initialStepId="learningTime" />,
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Startzeit auswählen" }),
		);
		expect(mockSetOnboardingAnswer).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Testzeit 18:05 auswählen" }),
		);
		expect(mockSetOnboardingAnswer).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Testauswahl bestätigen" }),
		);
		expect(mockSetOnboardingAnswer).toHaveBeenCalledWith(
			"learningTime",
			"18:05",
		);
	});

	test("never advances the study-time fact on a timer", async () => {
		jest.useFakeTimers();
		try {
			const screen = await render(
				<OnboardingScreen initialStepId="study-time-fact" />,
			);

			expect(
				screen.getByRole("header", {
					name: "Dein Lernplan braucht echte Zeitfenster.",
				}),
			).toBeOnTheScreen();
			await act(async () => jest.advanceTimersByTime(10_000));
			expect(
				screen.getByRole("header", {
					name: "Dein Lernplan braucht echte Zeitfenster.",
				}),
			).toBeOnTheScreen();
		} finally {
			jest.useRealTimers();
		}
	});

	test("requires birth year, month, and day as separate explicit choices", async () => {
		mockOnboarding.answers.birthYear = "";
		mockOnboarding.answers.birthMonth = "";
		mockOnboarding.answers.birthDay = "";
		const screen = await render(<OnboardingScreen initialStepId="birthYear" />);

		expect(screen.getByText("Geburtsjahr auswählen")).toBeOnTheScreen();
		expect(
			screen.getByTestId("onboarding-birth-year-picker"),
		).toBeOnTheScreen();

		expect(
			screen.getByRole("button", { name: "Weiter" }).props.accessibilityState,
		).toMatchObject({ disabled: true });
	});

	test("shows an existing-account error before leaving the email step", async () => {
		mockStartRegistrationWithEmail.mockRejectedValueOnce(
			new Error("Für diese E-Mail-Adresse gibt es bereits ein Konto."),
		);
		mockOnboarding.answers.email = "existing@example.com";
		const screen = await render(<OnboardingScreen initialStepId="email" />);

		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));

		expect(mockStartRegistrationWithEmail).toHaveBeenCalledWith(
			"existing@example.com",
		);
		expect(
			await screen.findByRole("alert", {
				name: "Für diese E-Mail-Adresse gibt es bereits ein Konto.",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("header", { name: "Wie lautet deine E-Mail-Adresse?" }),
		).toBeOnTheScreen();
		expect(
			screen.queryByRole("header", { name: "Lege dein Passwort fest." }),
		).toBeNull();
	});

	test("explains invalid typed input while keeping continuation disabled", async () => {
		mockOnboarding.answers.email = "keine-adresse";
		const screen = await render(<OnboardingScreen initialStepId="email" />);

		expect(
			screen.getByRole("alert", {
				name: "Bitte gib eine gültige E-Mail-Adresse ein.",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Weiter" }).props.accessibilityState,
		).toMatchObject({ disabled: true });
	});

	test("blocks duplicate email checks while availability is pending", async () => {
		let finishEmailCheck!: () => void;
		mockStartRegistrationWithEmail.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishEmailCheck = resolve;
				}),
		);
		const screen = await render(<OnboardingScreen initialStepId="email" />);
		const continueButton = screen.getByRole("button", { name: "Weiter" });

		await fireEvent.press(continueButton);
		await fireEvent.press(continueButton);

		expect(mockStartRegistrationWithEmail).toHaveBeenCalledTimes(1);
		const busyButton = await screen.findByRole("button", {
			name: "Wird verarbeitet",
		});
		expect(busyButton.props.accessibilityState).toMatchObject({
			busy: true,
			disabled: true,
		});

		await act(async () => finishEmailCheck());

		expect(
			await screen.findByRole("header", { name: "Lege dein Passwort fest." }),
		).toBeOnTheScreen();
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
