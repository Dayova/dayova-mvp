import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, waitFor } from "@testing-library/react-native";
import GeneratingScreen from "~/app/(creation)/learning-plans/[planId]/generating";

const mockReplace = jest.fn();
const mockMutation = jest.fn<() => Promise<void>>();
const mockAction = jest.fn<() => Promise<void>>();
let mockStatus = "generated";
let mockTimes: unknown[] | undefined = [];
const mockRouter = { replace: mockReplace, push: jest.fn() };
jest.mock("expo-router", () => ({
	useRouter: () => mockRouter,
	useLocalSearchParams: () => ({ planId: "plan-1" }),
	Stack: { Screen: () => null },
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useAction: () => mockAction,
	useMutation: () => mockMutation,
	useQuery: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		const name = getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		);
		if (name === "learningTimes:listMine") return mockTimes;
		if (name === "learningPlans:listAnswers") return [];
		if (name === "learningPlans:getGenerationProgress")
			return {
				contentGeneration: {
					stage: "ready",
					totalSessionCount: 1,
					readySessionCount: 1,
					failedSessionCount: 0,
				},
			};
		return {
			status: mockStatus,
			diagnosticPlacement: "firstSession",
			topicMap: [],
			examTypeLabel: "Test",
			examDateKey: "2026-09-30",
			targetStudyMinutes: 60,
		};
	},
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "qa-user" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: async () => true }),
}));
jest.mock("~/lib/use-validation-analytics", () => ({
	useValidationAnalytics: () => ({ capture: jest.fn() }),
}));
jest.mock("~/lib/navigation", () => ({
	useBackIntent: jest.fn(),
	goBackOrReplace: jest.fn(),
}));
jest.mock("~/features/learning-plans/creation-progress-shell", () => ({
	useLearningPlanCreationProgress: jest.fn(),
}));
jest.mock("~/components/ui/animated-flower-loader", () => ({
	AnimatedFlowerLoader: () => null,
}));
jest.mock("~/components/ui/support-contact", () => ({
	SupportContact: () => null,
}));
jest.mock("~/components/ui/button", () => ({ Button: () => null }));
jest.mock("~/components/ui/text", () => ({ Text: "Text" }));
jest.mock("~/components/ui/flow-progress-bar", () => ({
	FlowProgressBar: () => null,
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockStatus = "generated";
	mockTimes = [];
	mockMutation.mockResolvedValue(undefined);
});

test.each([
	[],
	undefined,
])("opens an already generated plan without waiting for learning times (%p)", async (times) => {
	mockTimes = times;
	render(<GeneratingScreen />);
	await waitFor(() =>
		expect(mockReplace).toHaveBeenCalledWith("/learning-plans/plan-1/review"),
	);
	expect(mockAction).not.toHaveBeenCalled();
	expect(mockMutation).not.toHaveBeenCalled();
});

test("does not start a new generation while learning times are still loading", () => {
	mockStatus = "questionsReady";
	mockTimes = undefined;
	render(<GeneratingScreen />);
	expect(mockReplace).not.toHaveBeenCalled();
	expect(mockAction).not.toHaveBeenCalled();
});
