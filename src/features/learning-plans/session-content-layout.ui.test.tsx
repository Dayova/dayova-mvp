import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { Platform, Text } from "react-native";
import { SessionContentLayout } from "./session-content-layout";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 34, top: 0, left: 0, right: 0 }),
}));
let mockKeyboardHeight = 0;
beforeEach(() => {
	mockKeyboardHeight = 0;
});
afterEach(() => {
	jest.restoreAllMocks();
});
jest.mock("react-native-keyboard-controller", () => {
	const { ScrollView, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		KeyboardAwareScrollView: ScrollView,
		KeyboardAvoidingView: View,
		useKeyboardState: () => mockKeyboardHeight,
	};
});

test("keeps Android actions in the scroll while the keyboard overlays the window", async () => {
	jest.replaceProperty(Platform, "OS", "android");
	const screen = await render(
		<SessionContentLayout
			horizontalPadding={20}
			keyboardEnabled
			bounces
			footer={<Text>Beantworten</Text>}
		>
			<Text>Antwortfeld</Text>
		</SessionContentLayout>,
	);
	const layout = (height: number) => ({
		nativeEvent: { layout: { height, width: 320, x: 0, y: 0 } },
	});
	const scrollContainsActions = () =>
		Boolean(
			within(screen.getByTestId("session-scroll")).queryByText("Beantworten"),
		);
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(1000));
	await fireEvent(screen.getByTestId("session-actions"), "layout", layout(100));
	expect(scrollContainsActions()).toBe(false);
	mockKeyboardHeight = 300;
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(999));
	expect(scrollContainsActions()).toBe(true);
	mockKeyboardHeight = 0;
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(1000));
	expect(scrollContainsActions()).toBe(false);
});

test("moves oversized actions into the question scroll and pins them again when room returns", async () => {
	const screen = await render(
		<SessionContentLayout
			horizontalPadding={20}
			keyboardEnabled={false}
			bounces={false}
			footer={<Text>Beantworten</Text>}
		>
			<Text>Lange Frage und alle Antworten</Text>
		</SessionContentLayout>,
	);
	const layout = (height: number) => ({
		nativeEvent: { layout: { height, width: 320, x: 0, y: 0 } },
	});
	const scrollContainsActions = () =>
		Boolean(
			within(screen.getByTestId("session-scroll")).queryByText("Beantworten"),
		);
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(500));
	await fireEvent(screen.getByTestId("session-actions"), "layout", layout(150));
	expect(scrollContainsActions()).toBe(false);
	// Keyboard padding on iOS must also trigger the scrollable placement.
	mockKeyboardHeight = 320;
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(501));
	expect(scrollContainsActions()).toBe(true);
	mockKeyboardHeight = 0;
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(500));
	expect(scrollContainsActions()).toBe(false);
	await fireEvent(screen.getByTestId("session-actions"), "layout", layout(300));
	expect(scrollContainsActions()).toBe(true);
	expect(screen.getByTestId("session-scroll").props.scrollEnabled).not.toBe(
		false,
	);
	await fireEvent(screen.getByTestId("session-body"), "layout", layout(900));
	expect(scrollContainsActions()).toBe(false);
});
