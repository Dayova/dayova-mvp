import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import type { ThemePreference } from "~/lib/theme-preference";
import { ThemePreferenceToggle } from "./theme-preference-toggle";

jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		Easing: { cubic: jest.fn(), out: (value: unknown) => value },
		ReduceMotion: { System: "system" },
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useSharedValue: (initial: number) => ({
			get: () => initial,
			set: jest.fn(),
		}),
		withTiming: (value: number) => value,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { secondaryText: "#697586" } }),
}));
jest.mock("~/components/ui/icon", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { Computer: Native.View, Moon: Native.View, Sun: Native.View };
});

function Picker() {
	const [preference, setPreference] = useState<ThemePreference>("system");
	return (
		<ThemePreferenceToggle
			preference={preference}
			setPreference={async (value) => setPreference(value)}
		/>
	);
}

describe("theme preference selection", () => {
	test("keeps one selection indicator mounted when the selected option changes", async () => {
		const screen = await render(<Picker />);
		const indicator = screen.getByTestId("theme-selection-indicator");
		await fireEvent.press(
			screen.getByRole("radio", { name: "Dunkles Design verwenden" }),
		);
		expect(
			screen.getByRole("radio", { name: "Dunkles Design verwenden" }),
		).toBeChecked();
		expect(screen.getByTestId("theme-selection-indicator")).toBe(indicator);
		await fireEvent.press(
			screen.getByRole("radio", { name: "Helles Design verwenden" }),
		);
		expect(
			screen.getByRole("radio", { name: "Helles Design verwenden" }),
		).toBeChecked();
		expect(
			screen.getByRole("radio", { name: "Dunkles Design verwenden" }),
		).not.toBeChecked();
		expect(screen.getByTestId("theme-selection-indicator")).toBe(indicator);
	});
	test("does not save the already selected preference again", async () => {
		const setPreference = jest.fn(async () => undefined);
		const screen = await render(
			<ThemePreferenceToggle
				preference="system"
				setPreference={setPreference}
			/>,
		);
		await fireEvent.press(
			screen.getByRole("radio", { name: "Systemdesign verwenden" }),
		);
		expect(setPreference).not.toHaveBeenCalled();
	});
});
