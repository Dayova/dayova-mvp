import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { triggerSelectionHaptic } from "~/lib/safe-haptics";
import { Pencil } from "./icon";
import { SelectionOptionRow } from "./selection-option-row";

jest.mock("~/lib/safe-haptics", () => ({ triggerSelectionHaptic: jest.fn() }));

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
	jest.mocked(triggerSelectionHaptic).mockClear();
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
	await fireEvent.press(screen.getByRole("radio"));
	expect(onPress).toHaveBeenCalledTimes(1);
	expect(triggerSelectionHaptic).toHaveBeenCalledTimes(selected ? 0 : 1);
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual<Record<string, unknown>>(
		"../../../tests/mocks/selection-reanimated.cjs",
	),
);

test("exam and subject rows do not commit a canceled selection", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<SelectionOptionRow
			Icon={Pencil}
			label="Klausur"
			selected={false}
			onPress={onPress}
		/>,
	);
	const row = screen.getByRole("radio", { name: "Klausur" });
	await fireEvent(row, "pressIn");
	await fireEvent(row, "pressOut");
	expect(onPress).not.toHaveBeenCalled();
	await fireEvent.press(row);
	expect(onPress).toHaveBeenCalledTimes(1);
});
