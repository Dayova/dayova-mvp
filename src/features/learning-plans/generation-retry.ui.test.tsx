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
import { getDayKey } from "~/lib/day-key";
import { getLearningPlanCreationProgressPercentage } from "./creation-progress";
import type { LearningPlanGenerationFailureReason } from "./generation-recovery";
import { calculateAvailableStudyMinutes } from "./plan-workload";

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockGeneratePlan = jest.fn(async () => ({ sessionCount: 2 }));
const mockRetryFailedContent = jest.fn(async () => ({ isReady: true }));
const mockRequestAiConsent = jest.fn(async () => true);
const mockSetTargetStudyMinutes = jest.fn(async () => undefined);
const mockCapture = jest.fn();
const mockBackIntent = jest.fn();
const mockConfigureProgress =
	jest.fn<(configuration: { currentStep: number }) => void>();
let mockRetryPress: (() => void) | undefined;
let mockLearningTimes: Array<{
	dayOfWeek: number;
	startTime: string;
	endTime: string;
}> = [];
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
	useMutation: () => mockSetTargetStudyMinutes,
	useQuery: (_reference: unknown, args: { id?: string }) =>
		args.id ? mockSnapshot : mockLearningTimes,
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

const addSufficientAvailability = () => {
	mockLearningTimes = Array.from({ length: 7 }, (_, index) => ({
		dayOfWeek: index + 1,
		startTime: "16:00",
		endTime: "17:00",
	}));
	expect(
		calculateAvailableStudyMinutes({
			fromDateKey: getDayKey(new Date()),
			examDateKey: mockSnapshot.plan.examDateKey,
			learningTimes: mockLearningTimes,
		}),
	).toBeGreaterThan(20);
};

describe("learning-plan generation recovery", () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: new Date("2026-10-07T10:00:00Z") });
		jest.clearAllMocks();
		mockGeneratePlan.mockResolvedValue({ sessionCount: 2 });
		mockLearningTimes = [];
		mockSnapshot.sessions = [];
		mockSnapshot.plan.contentGeneration.failureReason = "schedulingConstraints";
		mockSnapshot.plan.contentGeneration.failureMessage = undefined;
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
		addSufficientAvailability();
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
		addSufficientAvailability();
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
		addSufficientAvailability();
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

	test("retries a persisted scheduling failure after correcting learning times and reopening", async () => {
		const before = await render(<LearningPlanGeneratingScreen />);
		await fireEvent.press(
			before.getByRole("button", { name: "Lernzeit eintragen" }),
		);
		expect(mockRouter.push).toHaveBeenCalledWith(
			expect.stringContaining(
				"returnTo=%2Flearning-plans%2Fplan-1%2Fgenerating",
			),
		);
		await before.unmount();
		addSufficientAvailability();
		const after = await render(<LearningPlanGeneratingScreen />);
		await fireEvent.press(
			after.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() => expect(mockGeneratePlan).toHaveBeenCalledTimes(1));
		expect(mockGeneratePlan).toHaveBeenCalledWith({
			learningPlanId: "plan-1",
			answers: [],
			sessionCompositionVariant: "split",
		});
		expect(mockRetryFailedContent).not.toHaveBeenCalled();
	});

	test("retries incomplete sessions rather than regenerating an existing plan", async () => {
		mockSnapshot.plan.contentGeneration.failureReason = "generationProcessing";
		mockSnapshot.sessions = [{ id: "ready-session" }, { id: "failed-session" }];
		addSufficientAvailability();
		const screen = await render(<LearningPlanGeneratingScreen />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await waitFor(() =>
			expect(mockRetryFailedContent).toHaveBeenCalledWith({
				learningPlanId: "plan-1",
			}),
		);
		expect(mockGeneratePlan).not.toHaveBeenCalled();
	});

	test("shows the affected document when a processing failure is reopened", async () => {
		mockSnapshot.plan.contentGeneration.failureReason = "materialProcessing";
		mockSnapshot.plan.contentGeneration.failureMessage =
			'Die Datei "arbeitsblatt.docx" konnte nicht verarbeitet werden. Ersetze sie oder lade sie erneut hoch.';
		addSufficientAvailability();
		const screen = await render(<LearningPlanGeneratingScreen />);
		expect(
			screen.getByText(mockSnapshot.plan.contentGeneration.failureMessage),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Material ergänzen oder ersetzen" }),
		).toBeOnTheScreen();
	});

	test("rejects two retry activations before the next render and exposes busy state", async () => {
		mockSnapshot.plan.contentGeneration.failureReason = "generationProcessing";
		addSufficientAvailability();
		let finishGeneration:
			| ((result: { sessionCount: number }) => void)
			| undefined;
		mockGeneratePlan.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishGeneration = resolve;
				}),
		);
		const screen = await render(<LearningPlanGeneratingScreen />);
		expect(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		).toBeOnTheScreen();
		const retry = mockRetryPress;
		expect(retry).toBeDefined();
		await act(async () => {
			retry?.();
			retry?.();
		});
		expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button").props.accessibilityState).toMatchObject({
			busy: true,
			disabled: true,
		});
		await act(async () => finishGeneration?.({ sessionCount: 2 }));
		await waitFor(() =>
			expect(screen.getByRole("button").props.accessibilityState.busy).toBe(
				false,
			),
		);
	});
});
