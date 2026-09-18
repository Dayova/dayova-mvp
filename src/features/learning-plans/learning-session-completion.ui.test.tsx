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
	test("repeats a theory session", async () => {
		const onPrimary = jest.fn();
		const onRepeat = jest.fn();
		const screen = await render(
			<LearningSessionCompletion
				attemptCount={0}
				correctCount={0}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onRepeat={onRepeat}
				onPrimary={onPrimary}
				phase="theory"
			/>,
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Theorie abschließen" }),
		);
		expect(onPrimary).toHaveBeenCalledTimes(1);
		expect(onRepeat).not.toHaveBeenCalled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Nochmal lernen" }),
		);
		expect(onRepeat).toHaveBeenCalledTimes(1);
		await screen.unmount();
	});

	test("repeats a practice session without restoring Analyse", async () => {
		const onPrimary = jest.fn();
		const onRepeat = jest.fn();
		const screen = await render(
			<LearningSessionCompletion
				attemptCount={5}
				correctCount={3}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onRepeat={onRepeat}
				onPrimary={onPrimary}
				phase="practice"
			/>,
		);

		expect(screen.queryByText(/Analyse/)).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: "Zum Lernplan" }),
		);
		expect(onPrimary).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByRole("button", { name: "Nochmal üben" }));
		expect(onRepeat).toHaveBeenCalledTimes(1);
		await screen.unmount();
	});

	test("repeats a rehearsal session", async () => {
		const onPrimary = jest.fn();
		const onRepeat = jest.fn();
		const screen = await render(
			<LearningSessionCompletion
				attemptCount={5}
				correctCount={4}
				durationMinutes={10}
				isBusy={false}
				isDiagnostic={false}
				onRepeat={onRepeat}
				onPrimary={onPrimary}
				phase="rehearsal"
			/>,
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Nochmal testen" }),
		);
		expect(onRepeat).toHaveBeenCalledTimes(1);
		expect(onPrimary).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Zum Lernplan" })).toBeEnabled();
		await screen.unmount();
	});

	test("does not repeat a diagnostic session", async () => {
		const screen = await render(
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
		expect(screen.getByRole("button", { name: "Zum Lernplan" })).toBeEnabled();
		expect(screen.queryByText(/Analyse/)).toBeNull();
		await screen.unmount();
	});
});
