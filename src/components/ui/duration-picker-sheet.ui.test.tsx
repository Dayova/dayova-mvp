import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { DurationPickerSheet } from "./duration-picker-sheet";

jest.mock("@expo/ui", () => {
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Picker = Object.assign(View, { Item: () => null });
	return { Host: View, Picker };
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		resolvedTheme: "light",
		colors: { primary: "#00BAFF" },
	}),
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		children,
		footer,
		onClose,
	}: {
		children: import("react").ReactNode;
		footer: import("react").ReactNode;
		onClose: () => void;
	}) => {
		const { View, Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<View>
				{children}
				{footer}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Schließen"
					onPress={onClose}
				>
					<Text>Schließen</Text>
				</Pressable>
			</View>
		);
	},
}));

test("combines hour/minute values and confirms only on explicit acceptance", async () => {
	const confirm = jest.fn();
	const screen = await render(
		<DurationPickerSheet
			value={30}
			onConfirm={confirm}
			onDismiss={jest.fn()}
		/>,
	);
	await fireEvent(screen.getByTestId("duration-hours"), "valueChange", 1);
	await fireEvent(screen.getByTestId("duration-minutes"), "valueChange", 15);
	expect(confirm).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByRole("button", { name: "Übernehmen" }));
	expect(confirm).toHaveBeenCalledWith(75);
});

test("rejects zero and values beyond four hours; accepts the boundary", async () => {
	const screen = await render(
		<DurationPickerSheet
			value={30}
			onConfirm={jest.fn()}
			onDismiss={jest.fn()}
		/>,
	);
	await fireEvent(screen.getByTestId("duration-minutes"), "valueChange", 0);
	expect(screen.getByRole("button", { name: "Übernehmen" })).toBeDisabled();
	await fireEvent(screen.getByTestId("duration-hours"), "valueChange", 4);
	expect(screen.getByRole("button", { name: "Übernehmen" })).toBeEnabled();
	await fireEvent(screen.getByTestId("duration-minutes"), "valueChange", 5);
	expect(screen.getByRole("button", { name: "Übernehmen" })).toBeDisabled();
});

test("closing discards a changed duration", async () => {
	const confirm = jest.fn();
	const screen = await render(
		<DurationPickerSheet
			value={30}
			onConfirm={confirm}
			onDismiss={jest.fn()}
		/>,
	);
	await fireEvent(screen.getByTestId("duration-hours"), "valueChange", 2);
	await fireEvent.press(screen.getByRole("button", { name: "Schließen" }));
	expect(confirm).not.toHaveBeenCalled();
});
