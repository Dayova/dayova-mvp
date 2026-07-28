import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { AnimatedFlowerLoader } from "./animated-flower-loader";

const mockCancelAnimation = jest.fn();
const mockSharedValues: {
	get: () => unknown;
	set: (value: unknown) => void;
}[] = [];
const mockSetSharedValue = jest.fn();
const mockWithRepeat = jest.fn((value: unknown, repeatCount: number) => ({
	repeatCount,
	value,
}));
let mockReduceMotion = false;

jest.mock("react-native-reanimated", () => {
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");

	return {
		__esModule: true,
		default: {
			View: ReactNative.View,
		},
		cancelAnimation: (value: unknown) => mockCancelAnimation(value),
		Easing: {
			cubic: jest.fn(),
			inOut: (value: unknown) => value,
			out: (value: unknown) => value,
		},
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useReducedMotion: () => mockReduceMotion,
		useSharedValue: (initialValue: unknown) => {
			let currentValue = initialValue;
			const sharedValue = {
				get: () => currentValue,
				set: (value: unknown) => {
					currentValue = value;
					mockSetSharedValue(value);
				},
			};
			mockSharedValues.push(sharedValue);
			return sharedValue;
		},
		withDelay: (_duration: number, value: unknown) => value,
		withRepeat: (value: unknown, repeatCount: number) =>
			mockWithRepeat(value, repeatCount),
		withSequence: (...values: unknown[]) => values.at(-1),
		withTiming: (value: unknown) => value,
	};
});

describe("AnimatedFlowerLoader", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSharedValues.length = 0;
		mockReduceMotion = false;
	});

	test("starts both animation loops and cancels both when unmounted", async () => {
		const screen = await render(<AnimatedFlowerLoader />);

		expect(mockWithRepeat).toHaveBeenCalledTimes(2);
		expect(mockWithRepeat).toHaveBeenNthCalledWith(1, expect.anything(), -1);
		expect(mockWithRepeat).toHaveBeenNthCalledWith(2, expect.anything(), -1);
		expect(mockSharedValues).toHaveLength(2);

		await act(() => screen.unmount());

		expect(mockCancelAnimation).toHaveBeenCalledTimes(2);
		expect(mockCancelAnimation).toHaveBeenCalledWith(mockSharedValues[0]);
		expect(mockCancelAnimation).toHaveBeenCalledWith(mockSharedValues[1]);
	});

	test("keeps the expanded flower static when reduced motion is enabled", async () => {
		mockReduceMotion = true;

		const screen = await render(<AnimatedFlowerLoader />);

		expect(mockWithRepeat).not.toHaveBeenCalled();
		expect(mockSetSharedValue).toHaveBeenCalledWith(0);
		expect(mockSetSharedValue).toHaveBeenCalledWith(1);

		await act(() => screen.unmount());

		expect(mockCancelAnimation).not.toHaveBeenCalled();
	});
});
