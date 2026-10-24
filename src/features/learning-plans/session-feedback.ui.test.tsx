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
jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		useReducedMotion: () => mockReduceMotion,
		FadeIn: { duration: () => undefined },
		ZoomIn: {
			duration: () => ({ withInitialValues: () => undefined }),
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
});

test("reduced motion retains the accessible evaluation and ideal answer", async () => {
	mockReduceMotion = true;
	const screen = await render(<FeedbackView attempt={baseAttempt} />);
	expect(
		screen.getByRole("header", { name: "Richtige Antwort" }),
	).toBeOnTheScreen();
	expect(screen.getByText(baseAttempt.feedback)).toBeOnTheScreen();
	expect(screen.getByText(baseAttempt.perfectAnswer)).toBeOnTheScreen();
});

test("a new attempt replaces the previous rating and explanation", async () => {
	const screen = await render(<FeedbackView attempt={baseAttempt} />);

	await screen.rerender(
		<FeedbackView
			attempt={{
				...baseAttempt,
				id: "attempt_2" as SessionAnswerAttempt["id"],
				rating: "notCorrect",
				feedback: "Multipliziere die beiden Seitenlängen.",
				perfectAnswer: "3 cm × 4 cm = 12 cm².",
			}}
		/>,
	);

	expect(
		screen.getByRole("header", { name: "Noch nicht gewusst" }),
	).toBeOnTheScreen();
	expect(
		screen.getByText("Multipliziere die beiden Seitenlängen."),
	).toBeOnTheScreen();
	expect(screen.getByText("3 cm × 4 cm = 12 cm².")).toBeOnTheScreen();
	expect(screen.queryByText("Richtige Antwort")).toBeNull();
	expect(screen.queryByText(baseAttempt.feedback)).toBeNull();
	expect(screen.queryByText(baseAttempt.perfectAnswer)).toBeNull();
});
