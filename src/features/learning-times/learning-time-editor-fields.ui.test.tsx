import { describe, expect, jest, test } from "@jest/globals";
import { render, within } from "@testing-library/react-native";
import { LearningTimeEditorFields } from "./learning-time-editor-fields";

jest.mock("~/components/ui/icon", () => {
	const { Text } = jest.requireActual(
		"react-native",
	) as typeof import("react-native");
	return { Timer: () => <Text>Timer</Text> };
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: (
			jest.requireActual(
				"~/lib/design-system",
			) as typeof import("~/lib/design-system")
		).DAYOVA_DESIGN_SYSTEM.colors,
	}),
}));

describe("LearningTimeEditorFields", () => {
	test("renders compact weekday controls with a clear selected state", async () => {
		const screen = await render(
			<LearningTimeEditorFields
				selectedDay="Dienstag"
				startTime="17:00"
				endTime="17:30"
				onDayChange={jest.fn()}
				onStartTimePress={jest.fn()}
				onEndTimePress={jest.fn()}
			/>,
		);

		const selectedDay = screen.getByRole("radio", { name: "Dienstag" });
		expect(selectedDay.props.accessibilityState).toEqual({ checked: true });
		expect(selectedDay.props.style).toEqual(
			expect.objectContaining({ aspectRatio: 1, maxWidth: 48 }),
		);
		expect(within(selectedDay).getByText("Di").props.className).toContain(
			"text-white",
		);
	});

	test("uses bordered time fields without drop shadows", async () => {
		const screen = await render(
			<LearningTimeEditorFields
				selectedDay="Dienstag"
				startTime="17:00"
				endTime="17:30"
				onDayChange={jest.fn()}
				onStartTimePress={jest.fn()}
				onEndTimePress={jest.fn()}
			/>,
		);

		for (const label of ["Beginn: 17:00", "Ende: 17:30"]) {
			const timeField = screen.getByRole("button", { name: label });
			expect(timeField.props.className).toContain("border-border");
			expect(timeField.props.className).not.toContain("shadow");
		}
	});
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
