import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import {
	AccessibilityInfo,
	Animated,
	Pressable,
	Text,
	TouchableOpacity,
} from "react-native";
import { cssInterop, StyleSheet } from "react-native-css-interop";
import { cssToReactNativeRuntime } from "react-native-css-interop/css-to-rn";
import {
	FeedbackPressable,
	FeedbackTouchableOpacity,
} from "./feedback-pressable";

let preferenceChanged: (value: boolean) => void;
const remove = jest.fn();

beforeEach(() => {
	remove.mockClear();
	jest
		.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
		.mockResolvedValue(false);
	jest
		.spyOn(AccessibilityInfo, "addEventListener")
		.mockImplementation((_event, listener) => {
			preferenceChanged = listener as unknown as (value: boolean) => void;
			return { remove } as unknown as ReturnType<
				typeof AccessibilityInfo.addEventListener
			>;
		});
});
afterEach(() => {
	jest.restoreAllMocks();
});

test.each([
	FeedbackPressable,
	FeedbackTouchableOpacity,
])("animated controls preserve NativeWind class styles and caller styles", async (Control) => {
	// NativeWind registers these core mappings outside the test environment.
	cssInterop(Pressable, { className: "style" });
	cssInterop(TouchableOpacity, { className: "style" });
	StyleSheet.registerCompiled(
		cssToReactNativeRuntime(
			".px-4 { padding-left: 16px; padding-right: 16px; }",
		),
	);
	const screen = await render(
		<Control
			accessibilityRole="button"
			className="px-4"
			style={{ backgroundColor: "#123456" }}
		>
			<Text>Weiter</Text>
		</Control>,
	);
	expect(screen.getByRole("button")).toHaveStyle({
		paddingLeft: 16,
		paddingRight: 16,
		backgroundColor: "#123456",
	});
});

test("press feedback preserves callbacks, render children and functional styles", async () => {
	const onPress = jest.fn();
	const onPressIn = jest.fn();
	const onPressOut = jest.fn();
	const style = jest.fn(({ pressed }: { pressed: boolean }) => ({
		opacity: pressed ? 0.7 : 1,
	}));
	const screen = await render(
		<FeedbackPressable
			accessibilityRole="button"
			onPress={onPress}
			onPressIn={onPressIn}
			onPressOut={onPressOut}
			style={style}
		>
			{({ pressed }) => <Text>{pressed ? "Gedrückt" : "Weiter"}</Text>}
		</FeedbackPressable>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	expect(onPressIn).toHaveBeenCalledTimes(1);
	expect(style).toHaveBeenLastCalledWith({ pressed: true });
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).toHaveBeenCalledTimes(1);
	await fireEvent(screen.getByRole("button"), "pressOut", {});
	expect(onPressOut).toHaveBeenCalledTimes(1);
	expect(style).toHaveBeenLastCalledWith({ pressed: false });
});

test("disabled controls never dispatch their action", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<FeedbackPressable accessibilityRole="button" disabled onPress={onPress}>
			<Text>Speichern</Text>
		</FeedbackPressable>,
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).not.toHaveBeenCalled();
});

test("system reduced motion suppresses press animation but retains the action", async () => {
	jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
	const timing = jest.spyOn(Animated, "timing");
	const spring = jest.spyOn(Animated, "spring");
	const onPress = jest.fn();
	const screen = await render(
		<FeedbackPressable accessibilityRole="button" onPress={onPress}>
			<Text>Weiter</Text>
		</FeedbackPressable>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await fireEvent.press(screen.getByRole("button"));
	await fireEvent(screen.getByRole("button"), "pressOut", {});
	expect(timing).not.toHaveBeenCalled();
	expect(spring).not.toHaveBeenCalled();
	expect(onPress).toHaveBeenCalledTimes(1);
});

test("unsubscribes from system motion preferences when unmounted", async () => {
	const screen = await render(
		<FeedbackPressable accessibilityRole="button">
			<Text>Weiter</Text>
		</FeedbackPressable>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await act(() => preferenceChanged(true));
	await screen.unmount();
	expect(remove).toHaveBeenCalledTimes(1);
});

test("mounting and opted-out controls do not animate", async () => {
	const timing = jest.spyOn(Animated, "timing");
	const spring = jest.spyOn(Animated, "spring");
	const screen = await render(
		<FeedbackPressable accessibilityRole="button" pressFeedback={false}>
			<Text>Link</Text>
		</FeedbackPressable>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await fireEvent(screen.getByRole("button"), "pressOut", {});
	expect(timing).not.toHaveBeenCalled();
	expect(spring).not.toHaveBeenCalled();
	await screen.rerender(
		<FeedbackPressable accessibilityRole="button">
			<Text>Weiter</Text>
		</FeedbackPressable>,
	);
	expect(spring).not.toHaveBeenCalled();
});

test.each([
	FeedbackPressable,
	FeedbackTouchableOpacity,
])("dispatches one action after native feedback completes", async (Control) => {
	jest.spyOn(Animated, "timing").mockImplementation(() => ({
		start: (callback) => callback?.({ finished: true }),
		stop: jest.fn(),
		reset: jest.fn(),
	}));
	const onPress = jest.fn();
	const screen = await render(
		<Control accessibilityRole="button" onPress={onPress}>
			<Text>Weiter</Text>
		</Control>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).toHaveBeenCalledTimes(1);
	await fireEvent(screen.getByRole("button"), "pressOut", {});
});

test("disabling opacity controls during an interaction cancels their action", async () => {
	const onPress = jest.fn();
	const screen = await render(
		<FeedbackTouchableOpacity accessibilityRole="button" onPress={onPress}>
			<Text>Speichern</Text>
		</FeedbackTouchableOpacity>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await screen.rerender(
		<FeedbackTouchableOpacity
			accessibilityRole="button"
			disabled
			onPress={onPress}
		>
			<Text>Speichern</Text>
		</FeedbackTouchableOpacity>,
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).not.toHaveBeenCalled();
});

// Native feedback completes asynchronously; action delivery must not wait for it.
test.each([
	FeedbackPressable,
	FeedbackTouchableOpacity,
])("dispatches a short tap while native feedback is pending", async (Control) => {
	let finishCompression: ((result: { finished: boolean }) => void) | undefined;
	jest.spyOn(Animated, "timing").mockImplementation(() => ({
		start: (callback) => {
			finishCompression = callback;
		},
		stop: jest.fn(),
		reset: jest.fn(),
	}));
	const spring = jest.spyOn(Animated, "spring");
	const onPress = jest.fn();
	const screen = await render(
		<Control accessibilityRole="button" onPress={onPress} pressScale={0.92}>
			<Text>Heute</Text>
		</Control>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await fireEvent(screen.getByRole("button"), "pressOut", {});
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).toHaveBeenCalledTimes(1);
	expect(spring).not.toHaveBeenCalled();
	const finish = finishCompression;
	if (!finish)
		throw new Error("Native feedback must be pending before completion");
	await act(() => finish({ finished: true }));
});

test("pending compression cannot restart motion after reduced motion is enabled", async () => {
	let finishCompression: ((result: { finished: boolean }) => void) | undefined;
	jest.spyOn(Animated, "timing").mockImplementation(() => ({
		start: (callback) => {
			finishCompression = callback;
		},
		stop: jest.fn(),
		reset: jest.fn(),
	}));
	const spring = jest.spyOn(Animated, "spring");
	const screen = await render(
		<FeedbackPressable accessibilityRole="button">
			<Text>Zurück</Text>
		</FeedbackPressable>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	await fireEvent(screen.getByRole("button"), "pressOut", {});
	await act(() => preferenceChanged(true));
	const finish = finishCompression;
	if (!finish)
		throw new Error("Native feedback must be pending before completion");
	await act(() => finish({ finished: true }));
	expect(spring).not.toHaveBeenCalled();
});

test.each([
	FeedbackPressable,
	FeedbackTouchableOpacity,
])("forwards layout events to the caller", async (Control) => {
	const onLayout = jest.fn();
	const screen = await render(
		<Control accessibilityRole="button" onLayout={onLayout}>
			<Text>Bearbeiten</Text>
		</Control>,
	);
	const compact = {
		nativeEvent: { layout: { width: 44, height: 44, x: 0, y: 0 } },
	};
	await fireEvent(screen.getByRole("button"), "layout", compact);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	expect(onLayout).toHaveBeenCalledWith(compact);
});
