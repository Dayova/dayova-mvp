import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { BackButton } from "./button";
import { CloseButton } from "./close-button";

jest.mock("~/components/ui/icon", () => ({
	ArrowLeft: () => null,
	X: () => null,
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#1A1A1A" } }),
}));

test.each([
	{ label: "Zurück", Control: BackButton },
	{ label: "Schließen", Control: CloseButton },
])("$label dispatches its action and exposes disabled/busy state", async ({
	label,
	Control,
}) => {
	const onPress = jest.fn();
	const screen = await render(<Control onPress={onPress} />);
	await fireEvent.press(screen.getByRole("button", { name: label }));
	expect(onPress).toHaveBeenCalledTimes(1);
	await screen.rerender(
		<Control onPress={onPress} disabled accessibilityState={{ busy: true }} />,
	);
	const button = screen.getByRole("button", { name: label });
	expect(button).toBeDisabled();
	expect(button).toHaveProp("accessibilityState", {
		disabled: true,
		busy: true,
	});
	await fireEvent.press(button);
	expect(onPress).toHaveBeenCalledTimes(1);
});

test("a sheet keeps its contextual close label and hint", async () => {
	const screen = await render(
		<CloseButton
			accessibilityLabel="Fachauswahl schließen"
			accessibilityHint="Verwirft die Auswahl."
			onPress={() => {}}
		/>,
	);
	expect(
		screen.getByRole("button", { name: "Fachauswahl schließen" }),
	).toHaveProp("accessibilityHint", "Verwirft die Auswahl.");
});
