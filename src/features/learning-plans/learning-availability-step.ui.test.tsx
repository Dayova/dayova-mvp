import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { LearningAvailabilityStep } from "./learning-availability-step";

describe("LearningAvailabilityStep", () => {
	test("asks for a calm scheduling prerequisite without assigning workload", async () => {
		const screen = await render(
			<LearningAvailabilityStep
				availableStudyMinutes={0}
				examDateLabel="12. August 2026"
			/>,
		);

		expect(
			screen.getByText("Ein Zeitfenster reicht für den Anfang"),
		).toBeOnTheScreen();
		expect(
			screen.getByText(/noch nicht, wie viel du schaffen musst/),
		).toBeOnTheScreen();
	});

	test("confirms that an existing learning window can be used", async () => {
		const screen = await render(
			<LearningAvailabilityStep
				availableStudyMinutes={30}
				examDateLabel="12. August 2026"
			/>,
		);

		expect(screen.getByText("Lernzeit gefunden")).toBeOnTheScreen();
		expect(screen.queryByText(/noch nicht, wie viel/)).not.toBeOnTheScreen();
	});
});
