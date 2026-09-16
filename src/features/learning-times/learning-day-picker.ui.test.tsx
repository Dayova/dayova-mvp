import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { LearningDayPicker } from "./learning-day-picker";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			surface: "#FFFFFF",
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

		expect(thursday.props.accessibilityState).toEqual({ checked: true });
		expect(within(thursday).getByText("Do").props.className).toContain(
			"text-white",
		);
		expect(within(friday).getByText("Fr").props.className).toContain(
			"text-text",
		);

		await fireEvent.press(friday);
		expect(onSelectedDayChange).toHaveBeenCalledWith("Freitag");
	});
});
