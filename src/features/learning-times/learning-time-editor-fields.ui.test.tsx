import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
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
		expect(selectedDay.props.accessibilityState).toMatchObject({
			checked: true,
			disabled: false,
		});
		expect(screen.getAllByRole("radio")).toHaveLength(7);
	});
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
