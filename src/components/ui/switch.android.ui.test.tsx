import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Switch } from "./switch.android";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			mutedSurface: "#F3F6FA",
			primaryAccent: "#4FD8FF",
			secondaryText: "#697586",
			surface: "#FFFFFF",
		},
	}),
}));

describe("Android Switch accessibility", () => {
	test("toggles through the screen-reader activate action", async () => {
		const onValueChange = jest.fn();
		const screen = await render(
			<Switch
				accessibilityLabel="Push-Mitteilungen"
				value={false}
				onValueChange={onValueChange}
			/>,
		);

		fireEvent(
			screen.getByLabelText("Push-Mitteilungen"),
			"accessibilityAction",
			{
				nativeEvent: { actionName: "activate" },
			},
		);

		expect(onValueChange).toHaveBeenCalledWith(true);
	});

	test("does not toggle a disabled switch", async () => {
		const onValueChange = jest.fn();
		const screen = await render(
			<Switch
				accessibilityLabel="Push-Mitteilungen"
				value={false}
				disabled
				onValueChange={onValueChange}
			/>,
		);

		fireEvent(
			screen.getByLabelText("Push-Mitteilungen"),
			"accessibilityAction",
			{
				nativeEvent: { actionName: "activate" },
			},
		);

		expect(onValueChange).not.toHaveBeenCalled();
	});
});
