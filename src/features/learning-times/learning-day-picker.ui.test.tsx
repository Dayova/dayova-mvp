import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { LearningDayPicker } from "./learning-day-picker";

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			surface: "#FFFFFF",
			onPrimary: "#FFFFFF",
			text: "#181818",
			systemSubtle: "#F1F5F9",
			border: "#DCE7EE",
		},
	}),
}));

describe("LearningDayPicker", () => {
	test("uses white text for the selected weekday", async () => {
		const onSelectedDayChange = jest.fn();
		const screen = await render(
			<LearningDayPicker
				selectedDay="Donnerstag"
				onSelectedDayChange={onSelectedDayChange}
			/>,
		);
		const thursday = screen.getByRole("radio", { name: "Donnerstag" });
		const friday = screen.getByRole("radio", { name: "Freitag" });

		expect(thursday).toBeChecked();
		expect(within(thursday).getByText("Do")).toHaveStyle({ color: "#FFFFFF" });
		expect(within(friday).getByText("Fr")).toHaveStyle({ color: "#181818" });

		await fireEvent.press(friday);
		expect(onSelectedDayChange).toHaveBeenCalledWith("Freitag");
	});
});
