import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import LearningSessionContentScreen from "~/app/learning-plans/[planId]/sessions/[sessionId]/index";

const mockCapture = jest.fn();
const mockRouter = { dismissTo: jest.fn() };
const mockDismissBack = jest.fn();
const mockFinish = jest.fn<() => Promise<unknown>>();
const mockRecord =
	jest.fn<(args: { activeStudySeconds: number }) => Promise<unknown>>();
const mockExtend = jest.fn();
const mockPrepare = jest.fn<() => Promise<unknown>>();
const mockNoop = jest.fn();
const mockItem = { id: "item_1", kind: "written", prompt: "Letzte Aufgabe" };
const mockAttempt = {
	id: "attempt_1",
	itemId: "item_1",
	rating: "correct",
	feedback: "Richtig",
	perfectAnswer: "Antwort",
	createdAt: 1,
};
let mockContent: unknown;
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => mockContent,
	useAction: () => mockPrepare,
	useMutation: (reference: unknown) => {
		const { getFunctionName } =
			jest.requireActual<typeof import("convex/server")>("convex/server");
		const name = getFunctionName(
			reference as Parameters<typeof getFunctionName>[0],
		);
		if (name.endsWith(":finishSessionContent")) return mockFinish;
		if (name.endsWith(":recordSessionOutcome")) return mockRecord;
		if (name.endsWith(":extendSessionContent")) return mockExtend;
		return mockNoop;
	},
}));
jest.mock("@hugeicons/core-free-icons", () => ({}));
jest.mock("@hugeicons/react-native", () => ({ HugeiconsIcon: () => null }));
jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useLocalSearchParams: () => ({ planId: "plan_1", sessionId: "session_1" }),
	useRouter: () => mockRouter,
	useFocusEffect: () => {},
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "user_1" } }),
}));
jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: mockNoop }),
}));
jest.mock("~/lib/navigation", () => ({
	useBackIntent: () => {},
	dismissToOrReplace: () => mockDismissBack(),
}));
jest.mock("~/lib/use-validation-analytics", () => ({
	useValidationAnalytics: () => ({ capture: mockCapture }),
}));
jest.mock("~/lib/safe-haptics", () => ({ triggerSuccessHaptic: jest.fn() }));
jest.mock("~/features/learning-plans/use-prepare-session-content", () => ({
	usePrepareSessionContent: () => {},
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { background: "white", text: "black" } }),
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("react-native-keyboard-controller", () => {
	const { ScrollView, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		KeyboardAvoidingView: View,
		KeyboardAwareScrollView: ScrollView,
	};
});
jest.mock("~/components/ui/button", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		BackButton: () => null,
		Button: ({ children, ...props }: { children: React.ReactNode }) =>
			React.createElement(
				Pressable,
				{ accessibilityRole: "button", ...props },
				React.createElement(Text, {}, children),
			),
	};
});
jest.mock("~/components/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/question-progress-bar", () => ({
	QuestionProgressBar: () => null,
}));
jest.mock("~/features/learning-plans/session-feedback", () => ({
	FeedbackView: () => null,
}));
jest.mock("~/features/learning-plans/choice-list", () => ({
	ChoiceList: () => null,
}));
jest.mock("~/features/learning-plans/text-answer", () => ({
	TextAnswer: () => null,
}));
jest.mock("~/features/learning-plans/theory-topic-page", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		TheoryTopicPage: ({ onNext }: { onNext: () => void }) =>
			React.createElement(
				Pressable,
				{ onPress: onNext, accessibilityRole: "button" },
				React.createElement(Text, {}, "Thema verstanden"),
			),
	};
});
jest.mock("~/features/learning-plans/learning-session-completion", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		LearningSessionCompletion: ({ onPrimary }: { onPrimary: () => void }) =>
			React.createElement(
				Pressable,
				{ onPress: onPrimary, accessibilityRole: "button" },
				React.createElement(Text, {}, "Abschließen"),
			),
	};
});

beforeEach(() => {
	jest.clearAllMocks();
	mockFinish.mockResolvedValue({});
	mockPrepare.mockResolvedValue(mockAttempt);
	mockRecord.mockResolvedValue({
		rollingUpdate: { committedSessionId: null },
		outcomeAt: 1,
	});
});
test.each([
	"theory",
	"practice",
	"rehearsal",
] as const)("%s finishes its last content immediately without repeating or generating filler", async (phase) => {
	mockContent = {
		plan: { id: "plan_1" },
		session: {
			id: "session_1",
			phase,
			sessionPurpose: "learning",
			compositionVariant: "control",
			executionStatus: "started",
			durationMinutes: 30,
			contentGenerationVersion: 2,
			activeStudySeconds: 1,
		},
		items: [
			{
				...mockItem,
				kind: phase === "theory" ? "learnCard" : "written",
				phase,
			},
		],
		attempts: phase === "theory" ? [] : [mockAttempt],
	};
	const screen = await render(<LearningSessionContentScreen />);
	await act(async () => {
		fireEvent.press(
			screen.getByRole("button", {
				name:
					phase === "theory"
						? "Thema verstanden"
						: phase === "practice"
							? "Verstanden"
							: "Weiß ich nicht",
			}),
		);
	});
	expect(screen.getByRole("button", { name: "Abschließen" })).toBeOnTheScreen();
	await act(async () => {
		fireEvent.press(screen.getByRole("button", { name: "Abschließen" }));
	});
	expect(mockFinish).toHaveBeenCalledTimes(phase === "theory" ? 1 : 0);
	expect(mockRecord).toHaveBeenCalledWith(
		expect.objectContaining({
			outcome: "completed",
			activeStudySeconds: expect.any(Number),
		}),
	);
	expect(mockRecord.mock.calls[0]?.[0].activeStudySeconds).toBeLessThan(
		30 * 60,
	);
	expect(mockExtend).not.toHaveBeenCalled();
	expect(mockPrepare).toHaveBeenCalledTimes(phase === "rehearsal" ? 1 : 0);
	expect(mockRouter.dismissTo).toHaveBeenCalledTimes(
		phase === "theory" ? 0 : 1,
	);
	expect(mockDismissBack).toHaveBeenCalledTimes(phase === "theory" ? 1 : 0);
});
