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

		expect(screen.getByText("Noch nicht genug Lernzeit")).toBeOnTheScreen();
		expect(
			screen.getByText(/mindestens zwei kurze Lernblöcke/),
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

		expect(
			screen.getByText("Lernzeit grundsätzlich vorhanden"),
		).toBeOnTheScreen();
		expect(
			screen.getByText(/Welche zwei Termine wirklich frei sind/),
		).toBeOnTheScreen();
		expect(screen.queryByText(/noch nicht, wie viel/)).not.toBeOnTheScreen();
	});
});
