import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { LearningTimeSuggestionCard } from "./learning-time-suggestion-card";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");

	return {
		Clock3: () => React.createElement(Native.View, { testID: "clock-icon" }),
	};
});

const entries = [
	{ dayOfWeek: 1, startTime: "17:00", endTime: "17:30" },
	{ dayOfWeek: 3, startTime: "17:00", endTime: "17:30" },
];

test("labels generated times as a proposal and exposes all non-blocking choices", async () => {
	const onConfirm = jest.fn();
	const onAdjust = jest.fn();
	const onContinue = jest.fn();
	const screen = await render(
		<LearningTimeSuggestionCard
			entries={entries}
			variant="initial"
			isBusy={false}
			onConfirm={onConfirm}
			onAdjust={onAdjust}
			onContinue={onContinue}
		/>,
	);

	expect(screen.getByText("Vorschlag von Dayova")).toBeOnTheScreen();
	expect(screen.getByText("Mo 17:00–17:30 · Mi 17:00–17:30")).toBeOnTheScreen();
	await fireEvent.press(
		screen.getByRole("button", { name: "Zeiten übernehmen" }),
	);
	await fireEvent.press(screen.getByRole("button", { name: "Jetzt anpassen" }));
	await fireEvent.press(screen.getByRole("button", { name: "Weiterlernen" }));
	expect(onConfirm).toHaveBeenCalledTimes(1);
	expect(onAdjust).toHaveBeenCalledTimes(1);
	expect(onContinue).toHaveBeenCalledTimes(1);
});

describe("post-diagnostic reminder", () => {
	test("stays dismissible without hiding the learning path", async () => {
		const onContinue = jest.fn();
		const screen = await render(
			<LearningTimeSuggestionCard
				entries={entries}
				variant="postDiagnostic"
				isBusy={false}
				onConfirm={jest.fn()}
				onAdjust={jest.fn()}
				onContinue={onContinue}
			/>,
		);

		expect(
			screen.getByText("Mach deinen Lernplan noch genauer"),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Später" }));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});
});
