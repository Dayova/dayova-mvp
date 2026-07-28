import type { ReactNode } from "react";
import { describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { DateTimePickerSheet } from "./date-time-picker-sheet.android";

jest.mock("@expo/ui/jetpack-compose", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Host: ({ children, ...props }: { children: ReactNode }) =>
			React.createElement(
				"Host",
				{ ...props, testID: "compose-host" },
				children,
			),
		DatePickerDialog: (props: Record<string, unknown>) =>
			React.createElement("DatePickerDialog", {
				...props,
				testID: "date-picker-dialog",
			}),
		TimePickerDialog: (props: Record<string, unknown>) =>
			React.createElement("TimePickerDialog", {
				...props,
				testID: "time-picker-dialog",
			}),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ resolvedTheme: "dark" }),
}));

describe("Android DateTimePickerSheet", () => {
	test("renders the native date dialog inside a Dayova-themed Compose host", async () => {
		const onChange = jest.fn();
		const onClose = jest.fn();
		const value = new Date(2012, 8, 9, 16, 44);
		const screen = await render(
			<DateTimePickerSheet
				mode="date"
				onChange={onChange}
				onClose={onClose}
				value={value}
				visible
			/>,
		);

		expect(screen.getByTestId("compose-host").props).toMatchObject({
			colorScheme: "dark",
			seedColor: "#00BAFF",
		});
		const picker = screen.getByTestId("date-picker-dialog");
		expect(picker.props.initialDate).toBe("2012-09-09T00:00:00.000Z");

		await act(() =>
			picker.props.onDateSelected(new Date("2012-09-10T00:00:00Z")),
		);

		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "set",
				nativeEvent: expect.objectContaining({ timestamp: expect.any(Number) }),
			}),
			expect.any(Date),
		);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test("continues a datetime selection from date to time before closing", async () => {
		const onChange = jest.fn();
		const onClose = jest.fn();
		const screen = await render(
			<DateTimePickerSheet
				mode="datetime"
				onChange={onChange}
				onClose={onClose}
				value={new Date(2012, 8, 9, 16, 44)}
				visible
			/>,
		);

		await act(() =>
			screen
				.getByTestId("date-picker-dialog")
				.props.onDateSelected(new Date("2012-09-10T00:00:00Z")),
		);
		expect(onChange).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();

		await act(() =>
			screen
				.getByTestId("time-picker-dialog")
				.props.onDateSelected(new Date(2012, 8, 9, 18, 30)),
		);

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
		const selectedDate = onChange.mock.calls[0]?.[1] as Date;
		expect([
			selectedDate.getFullYear(),
			selectedDate.getMonth(),
			selectedDate.getDate(),
			selectedDate.getHours(),
			selectedDate.getMinutes(),
		]).toEqual([2012, 8, 10, 18, 30]);
	});
});
