import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Pencil } from "./icon";
import { SelectionOptionRow } from "./selection-option-row";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			secondaryText: "#697586",
			onPrimary: "#1A1A1A",
		},
	}),
}));
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Pencil: () => null,
		Check: (props: Record<string, unknown>) =>
			React.createElement("CheckIcon", props),
	};
});

test.each([
	true,
	false,
])("shared exam/subject row exposes checked=%s and wraps long labels", async (selected) => {
	const onPress = jest.fn();
	const label = "Eine sehr lange individuelle Prüfungsart oder Fachbezeichnung";
	const screen = await render(
		<SelectionOptionRow
			Icon={Pencil}
			label={label}
			selected={selected}
			onPress={onPress}
		/>,
	);
	expect(
		screen.getByRole("radio", { name: label }).props.accessibilityState,
	).toEqual({
		checked: selected,
		disabled: false,
	});
	expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
	await fireEvent.press(screen.getByRole("radio"));
	expect(onPress).toHaveBeenCalledTimes(1);
});

const mockAnimate = jest.fn();
jest.mock("react-native-reanimated", () => ({
	...jest.requireActual<Record<string, unknown>>(
		"../../../tests/mocks/selection-reanimated.cjs",
	),
	withTiming: (value: number) => {
		mockAnimate(value);
		return value;
	},
	withSpring: (value: number) => {
		mockAnimate(value);
		return value;
	},
}));

test("exam and subject rows animate a press without committing a canceled selection", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<SelectionOptionRow
			Icon={Pencil}
			label="Klausur"
			selected={false}
			onPress={onPress}
		/>,
	);
	mockAnimate.mockClear();
	const row = screen.getByRole("radio", { name: "Klausur" });
	await fireEvent(row, "pressIn");
	expect(mockAnimate).toHaveBeenCalledWith(0.98);
	await fireEvent(row, "pressOut");
	expect(mockAnimate).toHaveBeenCalledWith(1);
	expect(onPress).not.toHaveBeenCalled();
	await fireEvent.press(row);
	expect(onPress).toHaveBeenCalledTimes(1);
});
