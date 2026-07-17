import type { ReactNode } from "react";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Switch } from "./switch.android";

jest.mock("@expo/ui/jetpack-compose", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Host: ({ children }: { children: ReactNode }) =>
			React.createElement("Host", null, children),
		Switch: (props: Record<string, unknown>) =>
			React.createElement("ComposeSwitch", props),
	};
});

jest.mock("@expo/ui/jetpack-compose/modifiers", () => ({
	testID: (value: string) => ({ name: "testID", value }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE3EC",
			mutedSurface: "#F3F6FA",
			path3: "#B8C2CF",
			primaryAccent: "#4FD8FF",
			secondaryText: "#697586",
			surface: "#FFFFFF",
		},
		resolvedTheme: "light",
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
