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
	});
	expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
	expect(screen.getByRole("radio").props.className).toContain(
		selected ? "bg-accent" : "bg-card",
	);
	await fireEvent.press(screen.getByRole("radio"));
	expect(onPress).toHaveBeenCalledTimes(1);
});
