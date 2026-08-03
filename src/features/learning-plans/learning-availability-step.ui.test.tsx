import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import {
	LearningAvailabilityAction,
	LearningAvailabilityStep,
} from "./learning-availability-step";

describe("LearningAvailabilityStep", () => {
	test("asks for a calm scheduling prerequisite without assigning workload", async () => {
		const screen = await render(
			<LearningAvailabilityStep
				availabilityStatus="missing"
				examDateLabel="12. August 2026"
			/>,
		);

		expect(screen.getByText("Noch keine freie Lernzeit")).toBeOnTheScreen();
		expect(
			screen.getByText(/noch nicht, wie viel du schaffen musst/),
		).toBeOnTheScreen();
	});

	test("confirms that an existing learning window can be used", async () => {
		const screen = await render(
			<LearningAvailabilityStep
				availabilityStatus="available"
				examDateLabel="12. August 2026"
			/>,
		);

		expect(screen.getByText("Lernzeit gefunden")).toBeOnTheScreen();
		expect(screen.queryByText(/noch nicht, wie viel/)).not.toBeOnTheScreen();
	});

	test("explains how to recover when every saved learning time is occupied", async () => {
		const screen = await render(
			<LearningAvailabilityStep
				availabilityStatus="occupied"
				examDateLabel="12. August 2026"
			/>,
		);

		expect(
			screen.getByText("Deine Lernzeiten sind schon belegt"),
		).toBeOnTheScreen();
		expect(
			screen.getByText(/bestehenden Lerntermin.*zusätzliche Lernzeit/),
		).toBeOnTheScreen();
		expect(screen.queryByText("Lernzeit gefunden")).not.toBeOnTheScreen();
	});

	test("opens learning-time editing instead of continuing when time is occupied", async () => {
		const onContinue = jest.fn();
		const onEditLearningTimes = jest.fn();
		const screen = await render(
			<LearningAvailabilityAction
				availabilityStatus="occupied"
				onContinue={onContinue}
				onEditLearningTimes={onEditLearningTimes}
			/>,
		);

		fireEvent.press(screen.getByRole("button", { name: "Lernzeit eintragen" }));

		expect(onEditLearningTimes).toHaveBeenCalledTimes(1);
		expect(onContinue).not.toHaveBeenCalled();
	});
});
