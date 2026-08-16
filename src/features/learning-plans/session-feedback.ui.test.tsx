import { describe, expect, test } from "@jest/globals";
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
