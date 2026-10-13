import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, Text } from "react-native";
import {
	FeedbackPressable,
	FeedbackTouchableOpacity,
} from "./feedback-pressable";

let preferenceChanged: (value: boolean) => void;
const remove = jest.fn();

beforeEach(() => {
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

test("changing reduced motion during a press stops scaling immediately", async () => {
	const reset = jest.spyOn(Animated.Value.prototype, "setValue");
	const screen = await render(
		<FeedbackPressable accessibilityRole="button">
			<Text>Weiter</Text>
		</FeedbackPressable>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	reset.mockClear();
	await act(() => preferenceChanged(true));
	expect(reset).toHaveBeenCalledWith(1);
	await screen.unmount();
	expect(remove).toHaveBeenCalled();
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
])("a quick touch starts and releases motion without delaying the action", async (Control) => {
	const timing = jest.spyOn(Animated, "timing");
	const spring = jest.spyOn(Animated, "spring");
	const onPress = jest.fn();
	const screen = await render(
		<Control accessibilityRole="button" onPress={onPress}>
			<Text>Weiter</Text>
		</Control>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	expect(timing).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({ toValue: 0.97 }),
	);
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).toHaveBeenCalledTimes(1);
	await fireEvent(screen.getByRole("button"), "pressOut", {});
	expect(spring).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({ toValue: 1 }),
	);
});

test("opacity controls also stop motion when disabled during an interaction", async () => {
	const reset = jest.spyOn(Animated.Value.prototype, "setValue");
	const onPress = jest.fn();
	const screen = await render(
		<FeedbackTouchableOpacity accessibilityRole="button" onPress={onPress}>
			<Text>Speichern</Text>
		</FeedbackTouchableOpacity>,
	);
	await fireEvent(screen.getByRole("button"), "pressIn", {});
	reset.mockClear();
	await screen.rerender(
		<FeedbackTouchableOpacity
			accessibilityRole="button"
			disabled
			onPress={onPress}
		>
			<Text>Speichern</Text>
		</FeedbackTouchableOpacity>,
	);
	expect(reset).toHaveBeenCalledWith(1);
	await fireEvent.press(screen.getByRole("button"));
	expect(onPress).not.toHaveBeenCalled();
});
