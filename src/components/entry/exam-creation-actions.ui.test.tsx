import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { ExamCreationActions } from "./exam-creation-actions";

describe("ExamCreationActions", () => {
	test("blocks both creation paths while learning-plan availability is checked", async () => {
		const onCreateExam = jest.fn();
		const onCreateLearningPlan = jest.fn();
		const screen = await render(
			<ExamCreationActions
				canCreateExam
				canCreateLearningPlan
				isCheckingLearningPlanAvailability
				isCreating={false}
				onCreateExam={onCreateExam}
				onCreateLearningPlan={onCreateLearningPlan}
			/>,
		);

		fireEvent.press(screen.getByRole("button", { name: "Eintragen" }));
		fireEvent.press(
			screen.getByRole("button", {
				name: "Lernplan, Lernzeit wird geprüft",
			}),
		);

		expect(onCreateExam).not.toHaveBeenCalled();
		expect(onCreateLearningPlan).not.toHaveBeenCalled();
	});
});
