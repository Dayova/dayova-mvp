import { afterEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { BackButton } from "./button";
import { CloseButton } from "./close-button";

jest.mock("~/components/ui/icon", () => ({
	ArrowLeft: () => null,
	X: () => null,
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#1A1A1A" } }),
}));

afterEach(() => {
	jest.restoreAllMocks();
});

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

// Navigation controls share Button's motion instead of adding a second wrapper.
test.each([
	{ label: "Zurück", Control: BackButton },
	{ label: "Schließen", Control: CloseButton },
])("$label retains compact press feedback and touch callbacks", async ({
	label,
	Control,
}) => {
	jest
		.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
		.mockResolvedValue(false);
	const timing = jest.spyOn(Animated, "timing");
	const onPressIn = jest.fn();
	const onPressOut = jest.fn();
	const onPress = jest.fn();
	const screen = await render(
		<Control onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} />,
	);
	const button = screen.getByRole("button", { name: label });
	await fireEvent(button, "pressIn", {});
	expect(timing).toHaveBeenCalledTimes(1);
	expect(timing).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({ toValue: 0.92, duration: 90 }),
	);
	await fireEvent.press(button);
	await fireEvent(button, "pressOut", {});
	expect(onPressIn).toHaveBeenCalledTimes(1);
	expect(onPress).toHaveBeenCalledTimes(1);
	expect(onPressOut).toHaveBeenCalledTimes(1);
});
