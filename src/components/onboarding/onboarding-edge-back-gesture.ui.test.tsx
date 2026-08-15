import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { OnboardingEdgeBackGesture } from "./onboarding-edge-back-gesture";

const mockGestureCalls: string[] = [];
const mockGestureCallbacks = new Map<string, (...args: unknown[]) => void>();
const mockSharedValues: Array<{ initialValue: unknown; set: jest.Mock }> = [];

const getSharedValueSetter = (index: number) => {
	const sharedValue = mockSharedValues[index];
	if (!sharedValue) throw new Error(`Missing shared value at index ${index}`);
	return sharedValue.set;
};

jest.mock("react-native-gesture-handler", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const gesture = new Proxy(
		{},
		{
			get:
				(_target, property) =>
				(...args: unknown[]) => {
					mockGestureCalls.push(String(property));
					if (typeof args[0] === "function") {
						mockGestureCallbacks.set(
							String(property),
							args[0] as (...args: unknown[]) => void,
						);
					}
					return gesture;
				},
		},
	);

	return {
		Gesture: { Pan: () => gesture },
		GestureDetector: ({ children }: { children?: ReactNode }) =>
			React.createElement("GestureDetector", null, children),
	};
});

jest.mock("react-native-reanimated", () => {
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: ReactNative.View },
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		interpolate: () => 1,
		useAnimatedStyle: () => ({}),
		useReducedMotion: () => false,
		useSharedValue: (value: unknown) => {
			const set = jest.fn();
			mockSharedValues.push({ initialValue: value, set });
			return { get: () => value, set };
		},
		withTiming: (value: unknown) => value,
	};
});

jest.mock("react-native-worklets", () => ({
	scheduleOnRN: jest.fn(),
}));

describe("OnboardingEdgeBackGesture", () => {
	beforeEach(() => {
		mockGestureCalls.length = 0;
		mockGestureCallbacks.clear();
		mockSharedValues.length = 0;
	});

	test("mounts a stable edge hit target and configures a cancellable pan", async () => {
		const screen = await render(
			<OnboardingEdgeBackGesture enabled onBack={jest.fn()}>
				<View testID="content" />
			</OnboardingEdgeBackGesture>,
		);

		const edgeTarget = screen.getByTestId("onboarding-ios-edge-back");
		expect(edgeTarget.props.collapsable).toBe(false);
		expect(edgeTarget.props.accessible).toBe(false);
		expect(edgeTarget.props.className).toContain("left-0");
		expect(mockGestureCalls).toEqual(
			expect.arrayContaining([
				"enabled",
				"activeOffsetX",
				"failOffsetY",
				"onUpdate",
				"onEnd",
				"onFinalize",
			]),
		);
	});

	test("never commits a cancelled active gesture", async () => {
		await render(
			<OnboardingEdgeBackGesture enabled onBack={jest.fn()}>
				<View testID="content" />
			</OnboardingEdgeBackGesture>,
		);

		mockGestureCallbacks.get("onEnd")?.(
			{ translationX: 180, velocityX: 1200 },
			false,
		);
		expect(mockSharedValues.map(({ initialValue }) => initialValue)).toEqual([
			0,
			false,
		]);
		expect(getSharedValueSetter(0)).toHaveBeenCalledWith(0);
		expect(getSharedValueSetter(1)).not.toHaveBeenCalledWith(true);
	});

	test("does not intercept the screen edge when disabled", async () => {
		const screen = await render(
			<OnboardingEdgeBackGesture enabled={false} onBack={jest.fn()}>
				<View testID="content" />
			</OnboardingEdgeBackGesture>,
		);

		expect(screen.queryByTestId("onboarding-ios-edge-back")).toBeNull();
		expect(getSharedValueSetter(0)).toHaveBeenCalledWith(0);
		expect(getSharedValueSetter(1)).toHaveBeenCalledWith(false);
	});
});
