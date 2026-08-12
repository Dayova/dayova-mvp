import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { OnboardingEdgeBackGesture } from "./onboarding-edge-back-gesture";

const mockGestureCalls: string[] = [];

jest.mock("react-native-gesture-handler", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const gesture = new Proxy(
		{},
		{
			get:
				(_target, property) =>
				(..._args: unknown[]) => {
					mockGestureCalls.push(String(property));
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
		useSharedValue: (value: unknown) => ({
			get: () => value,
			set: jest.fn(),
		}),
		withTiming: (value: unknown) => value,
	};
});

jest.mock("react-native-worklets", () => ({
	scheduleOnRN: jest.fn(),
}));

describe("OnboardingEdgeBackGesture", () => {
	test("mounts a stable edge hit target and configures a cancellable pan", async () => {
		mockGestureCalls.length = 0;
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

	test("does not intercept the screen edge when disabled", async () => {
		const screen = await render(
			<OnboardingEdgeBackGesture enabled={false} onBack={jest.fn()}>
				<View testID="content" />
			</OnboardingEdgeBackGesture>,
		);

		expect(screen.queryByTestId("onboarding-ios-edge-back")).toBeNull();
	});
});
