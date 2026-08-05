import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { TheoryPredictionPage } from "./theory-topic-page";
import type { SessionContentItem } from "./types";

jest.mock("expo-router", () => ({
	useFocusEffect: () => undefined,
}));

jest.mock("expo-speech", () => ({
	maxSpeechInputLength: 4_000,
	speak: jest.fn(),
	stop: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		FadeInDown: { duration: () => undefined },
		LinearTransition: { duration: () => undefined },
		useReducedMotion: () => true,
	};
});

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			light1: "#FFFFFF",
			primary: "#00BAFF",
			text: "#1A1A1A",
		},
	}),
}));

const theoryItem = {
	id: "theory_1",
	sessionId: "session_1",
	phase: "theory",
	kind: "learnCard",
	title: "Schadensszenarien bewerten",
	prompt: "Welche Option ermöglicht eine objektive Bewertung?",
	explanation: "Betrachte mehrere Schadensszenarien systematisch.",
	idealAnswer: "Alle relevanten Auswirkungen werden berücksichtigt.",
	theoryContent: {
		conceptTitle: "Schadensszenarien bewerten",
		question: "Welche Option ermöglicht eine objektive Bewertung?",
		explanation: "Betrachte mehrere Schadensszenarien systematisch.",
		keyPoints: ["Materielle und immaterielle Schäden berücksichtigen."],
		example: "Bewerte Betriebsunterbrechung und rechtliche Folgen.",
		memoryCue: "Erst alle Auswirkungen betrachten, dann bewerten.",
		commonMistake: "Nur den direkten finanziellen Schaden betrachten.",
	},
	choices: [],
	learningBlockIndex: 0,
	topicId: "topic_1",
	questionAngle: "recognize",
	coverageKey: "topic_1:recognize:0",
	estimatedSeconds: 180,
	sortOrder: 0,
} as unknown as SessionContentItem;

describe("theory prediction page", () => {
	test("presents the question in the same topic hierarchy as its theory", async () => {
		const onChange = jest.fn();
		const onSubmit = jest.fn();
		const onSubmitUnknown = jest.fn();
		const screen = await render(
			<TheoryPredictionPage
				theoryItem={theoryItem}
				currentIndex={0}
				total={2}
				value="Mehrere Auswirkungen vergleichen"
				onChange={onChange}
				onSubmit={onSubmit}
				onSubmitUnknown={onSubmitUnknown}
				isSubmitting={false}
				errorMessage={null}
			/>,
		);

		expect(screen.getByText("THEMA 1")).toBeOnTheScreen();
		expect(screen.getByText("1 von 2")).toBeOnTheScreen();
		expect(screen.getByText("Schadensszenarien bewerten")).toBeOnTheScreen();
		expect(
			screen.getByText("Welche Option ermöglicht eine objektive Bewertung?"),
		).toBeOnTheScreen();
		expect(screen.queryByText("Kurz-Check")).toBeNull();
		expect(screen.queryByText("Noch nicht gewusst")).toBeNull();

		await fireEvent.changeText(
			screen.getByLabelText("Deine Einschätzung"),
			"Mehrere Auswirkungen vergleichen",
		);
		expect(onChange).toHaveBeenCalledWith("Mehrere Auswirkungen vergleichen");

		await fireEvent.press(screen.getByText("Unsicher"));
		expect(onSubmitUnknown).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("Erklärung ansehen"));
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
