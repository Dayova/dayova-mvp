import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import LearningPlanAnalysisScreen from "~/app/(creation)/learning-plans/[planId]/analysis";

const mockRouter = { replace: jest.fn(), dismissTo: jest.fn() };
const mockConsent = jest.fn(async () => true);
const mockWork = jest.fn(async () => {});
let mockSnapshot = {
	plan: {
		status: "draft",
		diagnosticPlacement: "firstSession",
		knowledgeQuestions: [],
		scopeConfirmedAt: undefined,
	},
};
let mockProgress: { onClose: () => void };
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => mockSnapshot,
	useAction: () => mockWork,
	useMutation: () => mockWork,
}));
jest.mock("expo-router", () => ({
	useRouter: () => mockRouter,
	useLocalSearchParams: () => ({ planId: "plan-1" }),
	Stack: { Screen: () => null },
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "user" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: mockConsent }),
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: (value: typeof mockProgress) => {
		mockProgress = value;
	},
}));
jest.mock("~/lib/navigation", () => ({
	useBackIntent: () => {},
	dismissToOrReplace: () => mockRouter.dismissTo("/learning-plans"),
	goBackOrReplace: () => {},
}));
jest.mock("~/components/ui/text", () => ({
	Text: jest.requireActual<typeof import("react-native")>("react-native").Text,
}));
jest.mock("~/components/ui/button", () => ({
	Button:
		jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("~/components/ui/error-message", () => ({
	ErrorMessage:
		jest.requireActual<typeof import("react-native")>("react-native").Text,
}));
jest.mock("~/features/learning-plans/plan-preparation-progress", () => ({
	PlanPreparationProgress: ({ stage }: { stage: number }) => {
		const React = jest.requireActual<typeof import("react")>("react");
		const { Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return React.createElement(Text, null, `Stage ${stage}`);
	},
}));

beforeEach(() => {
	jest.useFakeTimers();
	jest.clearAllMocks();
	mockSnapshot = {
		plan: {
			status: "draft",
			diagnosticPlacement: "firstSession",
			knowledgeQuestions: [],
			scopeConfirmedAt: undefined,
		},
	};
});
afterEach(() => {
	jest.useRealTimers();
});

test.each([
	false,
	true,
])("live completion waits for the visible sequence; leaving=%s", async (leave) => {
	const screen = await render(<LearningPlanAnalysisScreen />);
	await act(async () => {
		jest.runAllTicks();
	});
	await act(async () => {
		await jest.advanceTimersByTimeAsync(3000);
	});
	expect(screen.getByText("Stage 2")).toBeOnTheScreen();
	mockSnapshot = { plan: { ...mockSnapshot.plan, status: "generated" } };
	await screen.rerender(<LearningPlanAnalysisScreen />);
	expect(mockRouter.replace).not.toHaveBeenCalled();
	await act(async () => {
		await jest.advanceTimersByTimeAsync(1500);
	});
	expect(screen.getByText("Stage 3")).toBeOnTheScreen();
	expect(mockRouter.replace).not.toHaveBeenCalled();
	if (leave)
		await act(async () => {
			mockProgress.onClose();
		});
	await act(async () => {
		await jest.advanceTimersByTimeAsync(600);
	});
	if (leave) expect(mockRouter.replace).not.toHaveBeenCalled();
	else
		expect(mockRouter.replace).toHaveBeenCalledWith(
			"/learning-plans/plan-1/review",
		);
});

test("an already prepared plan resumes directly at review", async () => {
	mockSnapshot = { plan: { ...mockSnapshot.plan, status: "generated" } };
	await render(<LearningPlanAnalysisScreen />);
	expect(mockRouter.replace).toHaveBeenCalledWith(
		"/learning-plans/plan-1/review",
	);
	expect(mockWork).not.toHaveBeenCalled();
});
