import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { FeedbackView } from "~/features/learning-plans/session-feedback";
import type { SessionAnswerAttempt } from "~/features/learning-plans/types";

describe("session feedback", () => {
	test("renders escaped German evaluation text as readable characters", async () => {
		const attempt = {
			id: "attempt_1",
			itemId: "item_1",
			sessionId: "session_1",
			rating: "correct",
			feedback:
				"Du hast die finanziellen Sch&auml;den korrekt benannt. Diese k&ouml;nnen durch Bu&szlig;gelder entstehen.",
			perfectAnswer:
				"Finanzielle Sch&auml;den k&ouml;nnen durch Bu&szlig;gelder entstehen.",
			createdAt: 1,
		} as SessionAnswerAttempt;

		const screen = await render(<FeedbackView attempt={attempt} />);

		expect(
			screen.getByText(
				"Du hast die finanziellen Schäden korrekt benannt. Diese können durch Bußgelder entstehen.",
			),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Finanzielle Schäden können durch Bußgelder entstehen."),
		).toBeOnTheScreen();
		expect(screen.queryByText(/&(?:auml|ouml|szlig);/)).toBeNull();
	});
});

let mockReduceMotion = false;
const mockFade = jest.fn(() => "fade");
const mockSuccessAccent = jest.fn(() => "success-accent");
jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		useReducedMotion: () => mockReduceMotion,
		FadeIn: { duration: () => mockFade() },
		ZoomIn: {
			duration: () => ({ withInitialValues: () => mockSuccessAccent() }),
		},
	};
});
beforeEach(() => {
	mockReduceMotion = false;
	jest.clearAllMocks();
});

const baseAttempt = {
	id: "attempt_1",
	itemId: "item_1",
	sessionId: "session_1",
	rating: "correct",
	feedback: "Die Formel passt zur Aufgabe.",
	perfectAnswer: "Fläche = Länge × Breite.",
	createdAt: 1,
} as SessionAnswerAttempt;

test.each<{ rating: SessionAnswerAttempt["rating"]; title: string }>([
	{ rating: "correct", title: "Richtige Antwort" },
	{ rating: "partiallyCorrect", title: "Teilweise richtig" },
	{ rating: "notCorrect", title: "Noch nicht gewusst" },
])("$rating immediately exposes the evaluation and ideal answer", async ({
	rating,
	title,
}) => {
	const screen = await render(
		<FeedbackView attempt={{ ...baseAttempt, rating }} />,
	);
	expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
	expect(screen.getByText(baseAttempt.feedback)).toBeOnTheScreen();
	expect(screen.getByText(baseAttempt.perfectAnswer)).toBeOnTheScreen();
	expect(mockSuccessAccent).toHaveBeenCalledTimes(rating === "correct" ? 1 : 0);
});

test("reduced motion retains feedback without entrance or success motion", async () => {
	mockReduceMotion = true;
	const screen = await render(<FeedbackView attempt={baseAttempt} />);
	expect(
		screen.getByRole("header", { name: "Richtige Antwort" }),
	).toBeOnTheScreen();
	expect(screen.getByText(baseAttempt.feedback)).toBeOnTheScreen();
	expect(screen.getByText(baseAttempt.perfectAnswer)).toBeOnTheScreen();
	expect(mockFade).not.toHaveBeenCalled();
	expect(mockSuccessAccent).not.toHaveBeenCalled();
});
