import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { QuizStep } from "./quiz-step";

jest.mock("react-native-reanimated", () => ({
	useReducedMotion: () => true,
}));

describe("QuizStep", () => {
	test("offers low-friction choices and a clear unknown answer", async () => {
		const onAnswerChange = jest.fn();
		const screen = await render(
			<QuizStep
				answer=""
				errorMessage={null}
				isBusy={false}
				questionCount={5}
				questionNumber={2}
				onAnswerChange={onAnswerChange}
				onContinue={jest.fn()}
				question={{
					id: "q1",
					kind: "performance",
					responseKind: "multipleChoice",
					options: ["2", "3", "4"],
					prompt: "Welche Steigung hat die Gerade?",
					targetInsight: "Prüft die Steigungsberechnung.",
				}}
			/>,
		);

		await fireEvent.press(screen.getByRole("radio", { name: "Antwort A: 2" }));
		expect(onAnswerChange).toHaveBeenCalledWith("2");

		await fireEvent.press(
			screen.getByRole("button", { name: "Weiß ich nicht" }),
		);
		expect(onAnswerChange).toHaveBeenLastCalledWith("Weiß ich nicht");
		expect(screen.getByText("Frage 2 von 5")).toBeOnTheScreen();
	});
});
