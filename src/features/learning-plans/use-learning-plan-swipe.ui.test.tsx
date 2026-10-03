import { expect, jest, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";
import { useLearningPlanSwipe } from "./use-learning-plan-swipe";

const mockHandlers: Record<string, (event?: { translationX: number }) => void> =
	{};
jest.mock("react-native-gesture-handler", () => ({
	Gesture: {
		Pan: () => {
			const gesture: Record<string, unknown> = {};
			for (const name of [
				"activeOffsetX",
				"failOffsetY",
				"onBegin",
				"onStart",
				"onUpdate",
				"onEnd",
			]) {
				gesture[name] = (value: unknown) => {
					if (typeof value === "function")
						mockHandlers[name] = value as (typeof mockHandlers)[string];
					return gesture;
				};
			}
			return gesture;
		},
	},
}));
jest.mock("react-native-worklets", () => ({
	scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
		fn(...args),
}));
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		useSharedValue: (initial: number | boolean) => {
			const ref = React.useRef(initial);
			return {
				get: () => ref.current,
				set: (value: number | boolean) => {
					ref.current = value;
				},
			};
		},
		useAnimatedStyle: (fn: () => unknown) => fn(),
		interpolate: () => 1,
		Easing: { cubic: 0, out: () => 0 },
		withTiming: (value: number) => value,
		withSpring: (
			value: number,
			_config: unknown,
			done?: (finished: boolean) => void,
		) => {
			done?.(true);
			return value;
		},
	};
});

test("swipe release cannot open the plan; a subsequent deliberate arrow tap can", async () => {
	const onOpen = jest.fn();
	const { result } = await renderHook(() => useLearningPlanSwipe(onOpen));
	await act(() => {
		mockHandlers.onBegin();
		mockHandlers.onStart();
		mockHandlers.onUpdate({ translationX: -80 });
		mockHandlers.onEnd();
	});
	await act(() => result.current.open());
	expect(onOpen).not.toHaveBeenCalled();
	expect(result.current.isActionRailVisible).toBe(true);
	// The next tap closes the revealed actions, rather than navigating.
	await act(() => {
		mockHandlers.onBegin();
		result.current.open();
	});
	expect(onOpen).not.toHaveBeenCalled();
	expect(result.current.isActionRailVisible).toBe(false);
	await act(() => {
		mockHandlers.onBegin();
		result.current.open();
	});
	expect(onOpen).toHaveBeenCalledTimes(1);
});

test("short drag settling closed still suppresses its release press", async () => {
	const onOpen = jest.fn();
	const { result } = await renderHook(() => useLearningPlanSwipe(onOpen));
	await act(() => {
		mockHandlers.onBegin();
		mockHandlers.onStart();
		mockHandlers.onUpdate({ translationX: -20 });
		mockHandlers.onEnd();
	});
	await act(() => result.current.open());
	expect(onOpen).not.toHaveBeenCalled();
	await act(() => {
		mockHandlers.onBegin();
		result.current.open();
	});
	expect(onOpen).toHaveBeenCalledTimes(1);
});
