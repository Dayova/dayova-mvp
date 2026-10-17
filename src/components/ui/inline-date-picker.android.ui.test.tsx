import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { InlineDatePicker } from "./inline-date-picker.android";

jest.mock("@expo/ui", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Host: (props: Record<string, unknown>) =>
			React.createElement("Host", props),
	};
});
jest.mock("@expo/ui/jetpack-compose", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		DateTimePicker: (props: Record<string, unknown>) =>
			React.createElement("NativeCalendar", {
				...props,
				testID: "native-calendar",
			}),
	};
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		resolvedTheme: "dark",
		colors: { primary: "#00BAFF", onPrimary: "#1A1A1A", background: "#121214" },
	}),
}));

describe("Android inline date selection", () => {
	test("keeps calendar bounds and selected days in local calendar time across DST", async () => {
		const value = new Date(2026, 9, 24, 12);
		const onChange = jest.fn();
		const screen = await render(
			<InlineDatePicker
				value={value}
				minimumDate={new Date(2026, 9, 24)}
				maximumDate={new Date(2026, 10, 2)}
				onChange={onChange}
			/>,
		);
		const calendar = screen.getByTestId("native-calendar");
		expect(calendar.props.initialDate).toBe("2026-10-24T00:00:00.000Z");
		expect(calendar.props.selectableDates).toEqual({
			start: new Date(2026, 9, 24),
			end: new Date(2026, 10, 2),
		});
		await fireEvent(
			calendar,
			"dateSelected",
			new Date("2026-10-26T00:00:00.000Z"),
		);
		expect(onChange).toHaveBeenCalledWith(new Date(2026, 9, 26, 12));
		expect(screen.getByTestId("native-calendar")).toBeOnTheScreen();
	});
});
