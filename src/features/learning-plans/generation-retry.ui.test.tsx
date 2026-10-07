import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import LearningPlanGeneratingScreen from "~/app/(creation)/learning-plans/[planId]/generating";
import { getLearningPlanCreationProgressPercentage } from "./creation-progress";
import type { LearningPlanGenerationFailureReason } from "./generation-recovery";

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockPrepare = jest.fn<() => Promise<void>>(async () => undefined);
const mockRetryFailedContent = jest.fn(async () => ({ isReady: true }));
const mockGeneratePlan = jest.fn(async () => undefined);
const mockRequestAiConsent = jest.fn(async () => true);
const mockCapture = jest.fn();
const mockBackIntent = jest.fn();
const mockConfigureProgress =
	jest.fn<(configuration: { currentStep: number }) => void>();
let mockRetryPress: (() => void) | undefined;
let mockHasGeneration = true;
const mockSnapshot = {
	plan: {
		id: "plan-1",
		status: "questionsReady",
		diagnosticPlacement: "firstSession",
		examDateKey: "2026-10-21",
		examTypeLabel: "Klassenarbeit",
		durationMinutes: 45,
		targetStudyMinutes: 30,
		preparationDepth: "compact",
		topicMap: [],
		topicReadiness: [],
		contentGeneration: {
			stage: "failed",
			failureReason:
				"schedulingConstraints" as LearningPlanGenerationFailureReason,
			failureMessage: undefined as string | undefined,
			startedAt: undefined as number | undefined,
			totalSessionCount: 0,
			readySessionCount: 0,
			failedSessionCount: 0,
		},
	},
	answers: [],
	sessions: [] as Array<{ id: string }>,
	documents: [],
};

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useAction: (reference: unknown) => {
		const { getFunctionName } = require("convex/server");
		return getFunctionName(reference).endsWith(":generatePlan")
			? mockGeneratePlan
			: mockRetryFailedContent;
	},
	useMutation: () => mockPrepare,
	useQuery: (_reference: unknown, args: { id?: string }) =>
		args.id
			? {
					...mockSnapshot,
					plan: {
						...mockSnapshot.plan,
						contentGeneration: mockHasGeneration
							? { ...mockSnapshot.plan.contentGeneration }
							: undefined,
					},
				}
			: [],
}));
jest.mock("expo-router", () => ({
	useRouter: () => mockRouter,
	useLocalSearchParams: () => ({ planId: "plan-1" }),
	Stack: { Screen: () => null },
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "user-1" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: mockRequestAiConsent }),
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: (configuration: { currentStep: number }) =>
		mockConfigureProgress(configuration),
}));
jest.mock("~/lib/navigation", () => ({
	useBackIntent: (...args: unknown[]) => mockBackIntent(...args),
	goBackOrReplace: jest.fn(),
}));
jest.mock("~/lib/use-validation-analytics", () => ({
	useValidationAnalytics: () => ({ capture: mockCapture }),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/components/ui/screen", () => {
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Screen: View, ScreenScroll: View };
});
jest.mock("~/components/ui/animated-flower-loader", () => ({
	AnimatedFlowerLoader: () => null,
}));
jest.mock("~/components/ui/support-contact", () => ({
	SupportContact: () => null,
}));
// Keep the real button while capturing the handler to exercise two activations
// in one render, before React can apply the disabled state.
jest.mock("~/components/ui/button", () => {
	const actual = jest.requireActual<typeof import("~/components/ui/button")>(
		"~/components/ui/button",
	);
	return {
		...actual,
		Button: (props: React.ComponentProps<typeof actual.Button>) => {
			mockRetryPress = props.onPress as (() => void) | undefined;
			return <actual.Button {...props} />;
		},
	};
});
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: ReactNative.View },
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useReducedMotion: () => true,
		useSharedValue: (initial: number) => {
			const ref = React.useRef(initial);
			return React.useMemo(
				() => ({
					get: () => ref.current,
					set: (next: number) => {
						ref.current = next;
					},
				}),
				[],
			);
		},
		withTiming: (value: number) => value,
	};
});

describe("learning-plan generation recovery", () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: new Date("2026-10-07T10:00:00Z") });
		jest.clearAllMocks();
		mockPrepare.mockResolvedValue(undefined);
		mockHasGeneration = true;
		mockSnapshot.sessions = [];
		mockSnapshot.plan.contentGeneration.failureReason = "schedulingConstraints";
		mockSnapshot.plan.contentGeneration.failureMessage = undefined;
		mockSnapshot.plan.contentGeneration.startedAt = undefined;
		mockSnapshot.plan.contentGeneration.stage = "failed";
		mockSnapshot.plan.status = "questionsReady";
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	test.each([
		"failed",
		"content",
		"validating",
	])("keeps the shared creation header below completion during %s generation", async (stage) => {
		mockSnapshot.plan.contentGeneration.stage = stage;
		await render(<LearningPlanGeneratingScreen />);
		const configuration = mockConfigureProgress.mock.calls.at(-1)?.[0];
		expect(configuration).toBeDefined();
		expect(
			getLearningPlanCreationProgressPercentage(
				configuration?.currentStep ?? 0,
			),
		).toBe(90);
	});

	test("completes the shared header only when generation is ready", async () => {
		mockSnapshot.plan.contentGeneration.stage = "ready";
		mockSnapshot.plan.status = "generated";
		await render(<LearningPlanGeneratingScreen />);
		const configuration = mockConfigureProgress.mock.calls.at(-1)?.[0];
		expect(configuration).toBeDefined();
		expect(
			getLearningPlanCreationProgressPercentage(
				configuration?.currentStep ?? 0,
			),
		).toBe(100);
	});

	test("releases native removal protection before advancing a completed retry to review", async () => {
		const screen = await render(<LearningPlanGeneratingScreen />);
		expect(mockBackIntent).toHaveBeenLastCalledWith(
			true,
			expect.any(Function),
			{ allowRouteRemoval: false },
		);
		mockSnapshot.plan.status = "generated";
		mockSnapshot.plan.contentGeneration.stage = "ready";
		await screen.rerender(<LearningPlanGeneratingScreen />);
		expect(mockBackIntent).toHaveBeenLastCalledWith(
			true,
			expect.any(Function),
			{ allowRouteRemoval: true },
		);
		expect(mockRouter.replace).not.toHaveBeenCalled();
		await act(async () => {
			jest.advanceTimersByTime(20);
		});
		expect(mockRouter.replace).toHaveBeenCalledWith(
			"/learning-plans/plan-1/review",
		);
	});

	test("prepares the diagnostic without learning times despite a stale scheduling failure", async () => {
		const screen = await render(<LearningPlanGeneratingScreen />);
		await waitFor(() =>
			expect(mockPrepare).toHaveBeenCalledWith({ learningPlanId: "plan-1" }),
		);
		expect(mockRetryFailedContent).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: "Lernzeit eintragen" }),
		).toBeNull();
	});

	test("retries incomplete sessions rather than regenerating an existing plan", async () => {
		mockSnapshot.plan.contentGeneration.failureReason = "generationProcessing";
		mockSnapshot.sessions = [{ id: "ready-session" }, { id: "failed-session" }];
		const screen = await render(<LearningPlanGeneratingScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() =>
			expect(mockRetryFailedContent).toHaveBeenCalledWith({
				learningPlanId: "plan-1",
			}),
		);
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	test("rebuilds the schedule instead of finalizing old ready sessions after learning-time correction", async () => {
		mockSnapshot.sessions = [{ id: "old-ready-session" }];
		const screen = await render(<LearningPlanGeneratingScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() =>
			expect(mockGeneratePlan).toHaveBeenCalledWith({
				learningPlanId: "plan-1",
				answers: [],
			}),
		);
		expect(mockRetryFailedContent).not.toHaveBeenCalled();
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	test("keeps rescheduling a persisted scheduling failure after a transient retry error", async () => {
		mockSnapshot.sessions = [{ id: "old-ready-session" }];
		mockGeneratePlan.mockRejectedValueOnce(new Error("Network unavailable"));
		const screen = await render(<LearningPlanGeneratingScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() =>
			expect(
				screen.getByText(
					"Die Ursache konnte nicht sicher erkannt werden. Deine Angaben bleiben gespeichert; du kannst es erneut versuchen oder dein Material prüfen.",
				),
			).toBeOnTheScreen(),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() => expect(mockGeneratePlan).toHaveBeenCalledTimes(2));
		expect(mockRetryFailedContent).not.toHaveBeenCalled();
	});

	test("shows the affected document when a processing failure is reopened", async () => {
		mockSnapshot.plan.contentGeneration.failureReason = "materialProcessing";
		mockSnapshot.sessions = [{ id: "failed-session" }];
		mockSnapshot.plan.contentGeneration.failureMessage =
			'Die Datei "arbeitsblatt.docx" konnte nicht verarbeitet werden. Ersetze sie oder lade sie erneut hoch.';
		const screen = await render(<LearningPlanGeneratingScreen />);
		expect(
			screen.getByText(mockSnapshot.plan.contentGeneration.failureMessage),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Material ergänzen oder ersetzen" }),
		).toBeOnTheScreen();
	});

	test("retries a failed preparation directly and rejects two activations before the next render", async () => {
		mockPrepare.mockRejectedValueOnce(
			new Error("Temporary preparation failure"),
		);
		const screen = await render(<LearningPlanGeneratingScreen />);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Erneut versuchen" }),
			).toBeOnTheScreen(),
		);
		let finishPreparation: (() => void) | undefined;
		mockPrepare.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishPreparation = resolve;
				}),
		);
		const retry = mockRetryPress;
		await act(async () => {
			retry?.();
			retry?.();
		});
		expect(mockPrepare).toHaveBeenCalledTimes(2);
		expect(
			screen.getByRole("button", { name: "Erneut versuchen" }).props
				.accessibilityState,
		).toMatchObject({ busy: true, disabled: true });
		await act(async () => finishPreparation?.());
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Erneut versuchen" }),
			).toBeNull(),
		);
	});

	test("advances an already accepted plan without preparing it again", async () => {
		mockSnapshot.plan.status = "accepted";
		await render(<LearningPlanGeneratingScreen />);
		await act(async () => {
			jest.advanceTimersByTime(20);
		});
		expect(mockRouter.replace).toHaveBeenCalledWith(
			"/learning-plans/plan-1/review",
		);
		expect(mockPrepare).not.toHaveBeenCalled();
	});

	test("prepares a reanalysed legacy draft instead of waiting on obsolete sessions", async () => {
		mockSnapshot.sessions = [{ id: "obsolete-session" }];
		mockHasGeneration = false;
		await render(<LearningPlanGeneratingScreen />);
		await waitFor(() =>
			expect(mockPrepare).toHaveBeenCalledWith({ learningPlanId: "plan-1" }),
		);
		expect(mockRetryFailedContent).not.toHaveBeenCalled();
	});

	test("hides stale recovery when another device starts a fresh content claim", async () => {
		mockSnapshot.sessions = [{ id: "failed-session" }];
		mockSnapshot.plan.contentGeneration.stage = "content";
		mockSnapshot.plan.contentGeneration.startedAt = Date.now() - 12 * 60_000;
		const screen = await render(<LearningPlanGeneratingScreen />);
		await act(async () => {
			jest.advanceTimersByTime(1);
		});
		expect(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		).toBeOnTheScreen();
		mockSnapshot.plan.contentGeneration.startedAt = Date.now();
		await screen.rerender(<LearningPlanGeneratingScreen />);
		await act(async () => {
			jest.advanceTimersByTime(1);
		});
		expect(
			screen.queryByRole("button", { name: "Erneut versuchen" }),
		).toBeNull();
	});

	test("offers a new plan instead of retrying an oversized legacy draft", async () => {
		mockHasGeneration = false;
		mockPrepare.mockRejectedValueOnce({
			data: {
				kind: "userFacing",
				code: "legacy_plan_too_large",
				message:
					"Dieser Lernplan enthält zu viele Lerneinheiten. Erstelle einen neuen Lernplan.",
			},
		});
		const screen = await render(<LearningPlanGeneratingScreen />);
		const action = await screen.findByRole("button", {
			name: "Neuen Lernplan erstellen",
		});
		expect(
			screen.getByText(
				"Dieser Lernplan enthält zu viele Lerneinheiten. Erstelle einen neuen Lernplan.",
			),
		).toBeOnTheScreen();
		expect(
			screen.queryByRole("button", { name: "Erneut versuchen" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Material ergänzen oder ersetzen" }),
		).toBeNull();
		await fireEvent.press(action);
		expect(mockRouter.push).toHaveBeenCalledWith("/learning-plans/new");
	});

	test("does not postpone recovery for legacy claims without a timestamp when the query refreshes", async () => {
		mockSnapshot.sessions = [{ id: "failed-session" }];
		mockSnapshot.plan.contentGeneration.stage = "content";
		const screen = await render(<LearningPlanGeneratingScreen />);
		await act(async () => {
			jest.advanceTimersByTime(10 * 60_000);
		});
		await screen.rerender(<LearningPlanGeneratingScreen />);
		await act(async () => {
			jest.advanceTimersByTime(60_001);
		});
		expect(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		).toBeOnTheScreen();
	});
});
