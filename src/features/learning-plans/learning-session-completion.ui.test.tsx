import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { LearningSessionCompletion } from "~/features/learning-plans/learning-session-completion";

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useLocalSearchParams: () => ({ planId: "plan_1", sessionId: "session_1" }),
	useRouter: () => ({ dismissTo: jest.fn() }),
}));

jest.mock("convex/react", () => ({
	useAction: () => jest.fn(),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => jest.fn(),
	useQuery: () => null,
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlanAi: {
			ensureSessionContent: "ensureSessionContent",
			evaluateWrittenAnswer: "evaluateWrittenAnswer",
		},
		learningPlans: {
			recordSessionOutcome: "recordSessionOutcome",
			startSession: "startSession",
		},
		learningSessionContent: {
			extendSessionContent: "extendSessionContent",
			finishSessionContent: "finishSessionContent",
			getSessionContent: "getSessionContent",
			submitAnswer: "submitAnswer",
		},
	},
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { clerkId: "user_1" } }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			background: "#FFFFFF",
			border: "#DCE6EE",
			text: "#1A1A1A",
		},
	}),
}));

jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		FadeIn: { duration: () => undefined },
	};
});

describe("learning session completion", () => {
	test("finishes theory without offering another learning block", async () => {
		const onPrimary = jest.fn();
		const onContinueLearning = jest.fn();
		const screen = await render(
			<LearningSessionCompletion
				attemptCount={0}
				correctCount={0}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onContinueLearning={onContinueLearning}
				onPrimary={onPrimary}
				phase="theory"
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Theorie abschließen" }),
		).toBeEnabled();
		expect(screen.queryByText("Noch 10 Min. weiterlernen")).toBeNull();
		expect(
			screen.getByText(
				"Du hast alle Themen dieser Theorieeinheit geschafft. Gehe jetzt zum nächsten Schritt.",
			),
		).toBeTruthy();

		fireEvent.press(
			screen.getByRole("button", { name: "Theorie abschließen" }),
		);
		expect(onPrimary).toHaveBeenCalledTimes(1);
		expect(onContinueLearning).not.toHaveBeenCalled();
	});

	test("opens Analyse directly without offering another practice block", async () => {
		const onPrimary = jest.fn();
		const onContinueLearning = jest.fn();
		const screen = await render(
			<LearningSessionCompletion
				attemptCount={5}
				correctCount={3}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onContinueLearning={onContinueLearning}
				onPrimary={onPrimary}
				phase="practice"
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Analyse ansehen" }),
		).toBeEnabled();
		expect(screen.queryByText("Noch 10 Min. üben")).toBeNull();
		expect(screen.queryByText("Auswertung bereit")).toBeNull();
		expect(screen.queryByText("Deine Antworten sind ausgewertet.")).toBeNull();

		fireEvent.press(screen.getByRole("button", { name: "Analyse ansehen" }));
		expect(onPrimary).toHaveBeenCalledTimes(1);
		expect(onContinueLearning).not.toHaveBeenCalled();
	});
});
