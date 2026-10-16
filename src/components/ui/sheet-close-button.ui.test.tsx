import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { SheetCloseButton } from "./sheet-close-button.ios";

type Modifier = {
	$type: string;
	style?: string;
	label?: string;
	hint?: string;
};
const mockNativeButtons: Array<{ modifiers: Modifier[] }> = [];
const mockTheme = { isDark: false, colors: { text: "#1A1A1A" } };

// Model the SwiftUI boundary; these tests do not render Liquid Glass pixels.
jest.mock("@expo/ui", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Host: ({ children, ...props }: React.PropsWithChildren) =>
			React.createElement(View, { ...props, testID: "native-host" }, children),
		RNHostView: View,
		Button: ({
			children,
			modifiers,
			disabled,
			onPress,
		}: {
			children: React.ReactNode;
			modifiers: Modifier[];
			disabled?: boolean;
			onPress: () => void;
		}) => {
			mockNativeButtons.push({ modifiers });
			return React.createElement(
				Pressable,
				{
					accessibilityRole: "button",
					accessibilityLabel: modifiers.find(
						(value) => value.$type === "accessibilityLabel",
					)?.label,
					accessibilityHint: modifiers.find(
						(value) => value.$type === "accessibilityHint",
					)?.hint,
					accessibilityState: { disabled },
					disabled,
					onPress,
				},
				children,
			);
		},
	};
});
jest.mock("~/components/ui/icon", () => ({
	X: () => null,
	ArrowLeft: () => null,
}));
jest.mock("~/lib/theme", () => ({ useDayovaTheme: () => mockTheme }));

beforeEach(() => {
	mockNativeButtons.length = 0;
	mockTheme.isDark = false;
});
afterEach(() => {
	jest.restoreAllMocks();
});

test.each([
	{ version: 26, style: "glass" },
	{ version: "26.5", style: "glass" },
	{ version: 18, style: "bordered" },
])("iOS $version selects the native $style treatment", async ({
	version,
	style,
}) => {
	jest.spyOn(Platform, "Version", "get").mockReturnValue(version);
	const screen = await render(<SheetCloseButton onPress={() => {}} />);
	expect(screen.getByRole("button", { name: "Schließen" })).toBeEnabled();
	expect(mockNativeButtons.at(-1)?.modifiers).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ $type: "buttonStyle", style }),
			expect.objectContaining({ $type: "buttonBorderShape", shape: "circle" }),
		]),
	);
});

test("keeps contextual sheet labels, hints and disabled dismissal", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<SheetCloseButton
			accessibilityLabel="Fachauswahl schließen"
			accessibilityHint="Verwirft die Auswahl."
			onPress={onPress}
		/>,
	);
	const button = screen.getByRole("button", { name: "Fachauswahl schließen" });
	expect(button).toHaveProp("accessibilityHint", "Verwirft die Auswahl.");
	await fireEvent.press(button);
	expect(onPress).toHaveBeenCalledTimes(1);
	await screen.rerender(<SheetCloseButton onPress={onPress} disabled />);
	const disabled = screen.getByRole("button", { name: "Schließen" });
	expect(disabled).toBeDisabled();
	await fireEvent.press(disabled);
	expect(onPress).toHaveBeenCalledTimes(1);
});

test("keeps 48pt host bounds and follows app theme changes", async () => {
	const screen = await render(<SheetCloseButton onPress={() => {}} />);
	expect(screen.getByTestId("native-host")).toHaveStyle({
		width: 48,
		height: 48,
	});
	expect(screen.getByTestId("native-host")).toHaveProp("colorScheme", "light");
	mockTheme.isDark = true;
	await screen.rerender(<SheetCloseButton onPress={() => {}} />);
	expect(screen.getByTestId("native-host")).toHaveProp("colorScheme", "dark");
});

test("Android/web fallback keeps the existing close action without SwiftUI", async () => {
	const { SheetCloseButton: Fallback } = jest.requireActual<
		typeof import("./sheet-close-button")
	>("./sheet-close-button.tsx");
	const onPress = jest.fn();
	const screen = await render(
		<Fallback onPress={onPress} accessibilityLabel="Auswahl schließen" />,
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Auswahl schließen" }),
	);
	expect(onPress).toHaveBeenCalledTimes(1);
	expect(mockNativeButtons).toHaveLength(0);
});
