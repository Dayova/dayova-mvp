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
	test("uses the approved repeat action for every non-diagnostic phase", async () => {
		const onTheoryPrimary = jest.fn();
		const onTheoryRepeat = jest.fn();
		const screen = await render(
			<LearningSessionCompletion
				attemptCount={0}
				correctCount={0}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onRepeat={onTheoryRepeat}
				onPrimary={onTheoryPrimary}
				phase="theory"
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Theorie abschließen" }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Nochmal lernen" }),
		).toBeEnabled();
		expect(
			screen.getByText(
				"Du hast alle Themen dieser Theorieeinheit geschafft. Gehe jetzt zum nächsten Schritt.",
			),
		).toBeTruthy();

		await fireEvent.press(
			screen.getByRole("button", { name: "Theorie abschließen" }),
		);
		expect(onTheoryPrimary).toHaveBeenCalledTimes(1);
		expect(onTheoryRepeat).not.toHaveBeenCalled();

		await fireEvent.press(
			screen.getByRole("button", { name: "Nochmal lernen" }),
		);
		expect(onTheoryRepeat).toHaveBeenCalledTimes(1);

		const onPracticePrimary = jest.fn();
		const onPracticeRepeat = jest.fn();
		await screen.rerender(
			<LearningSessionCompletion
				attemptCount={5}
				correctCount={3}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onRepeat={onPracticeRepeat}
				onPrimary={onPracticePrimary}
				phase="practice"
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Analyse ansehen" }),
		).toBeEnabled();
		expect(screen.getByRole("button", { name: "Nochmal üben" })).toBeEnabled();
		expect(screen.queryByText("Auswertung bereit")).toBeNull();
		expect(screen.queryByText("Deine Antworten sind ausgewertet.")).toBeNull();

		await fireEvent.press(
			screen.getByRole("button", { name: "Analyse ansehen" }),
		);
		expect(onPracticePrimary).toHaveBeenCalledTimes(1);
		expect(onPracticeRepeat).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("button", { name: "Nochmal üben" }));
		expect(onPracticeRepeat).toHaveBeenCalledTimes(1);

		const onPraxisPrimary = jest.fn();
		const onPraxisRepeat = jest.fn();
		await screen.rerender(
			<LearningSessionCompletion
				attemptCount={5}
				correctCount={4}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onRepeat={onPraxisRepeat}
				onPrimary={onPraxisPrimary}
				phase="rehearsal"
			/>,
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Nochmal testen" }),
		);
		expect(onPraxisRepeat).toHaveBeenCalledTimes(1);
		expect(onPraxisPrimary).not.toHaveBeenCalled();

		await screen.rerender(
			<LearningSessionCompletion
				attemptCount={5}
				correctCount={3}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic
				onRepeat={jest.fn()}
				onPrimary={jest.fn()}
				phase="practice"
			/>,
		);

		expect(screen.queryByText("Nochmal üben")).toBeNull();
		await screen.unmount();
	});
});
