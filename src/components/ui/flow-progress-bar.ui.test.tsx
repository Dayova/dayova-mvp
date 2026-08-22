import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { FlowProgressBar } from "./flow-progress-bar";

const mockSetProgress = jest.fn();
const mockWithTiming = jest.fn((value: number, _config?: unknown) => ({
	animatedTo: value,
}));
let mockReducedMotion = false;

jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");

	return {
		__esModule: true,
		default: { View: ReactNative.View },
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useReducedMotion: () => mockReducedMotion,
		useSharedValue: (initialValue: number) => {
			const valueRef = React.useRef(initialValue);
			return React.useMemo(
				() => ({
					get: () => valueRef.current,
					set: (nextValue: unknown) => {
						mockSetProgress(nextValue);
						if (typeof nextValue === "number") valueRef.current = nextValue;
					},
				}),
				[],
			);
		},
		withTiming: (value: number, config: unknown) =>
			mockWithTiming(value, config),
	};
});

describe("FlowProgressBar", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockReducedMotion = false;
	});

	test("starts at the current value and animates later progress changes", async () => {
		const screen = await render(<FlowProgressBar progress={0.25} />);

		expect(mockWithTiming).not.toHaveBeenCalled();
		expect(mockSetProgress).toHaveBeenLastCalledWith(0.25);

		await act(() => screen.rerender(<FlowProgressBar progress={0.5} />));

		expect(mockWithTiming).toHaveBeenCalledWith(0.5, {
			duration: 260,
			easing: "cubic",
		});
		expect(mockSetProgress).toHaveBeenLastCalledWith({ animatedTo: 0.5 });
	});

	test("updates immediately when reduced motion is enabled", async () => {
		const screen = await render(<FlowProgressBar progress={0.25} />);
		mockSetProgress.mockClear();
		mockReducedMotion = true;

		await act(() => screen.rerender(<FlowProgressBar progress={0.5} />));

		expect(mockWithTiming).not.toHaveBeenCalled();
		expect(mockSetProgress).toHaveBeenLastCalledWith(0.5);
	});

	test("animates backward progress changes with the same restrained transition", async () => {
		const screen = await render(<FlowProgressBar progress={0.5} />);

		await act(() => screen.rerender(<FlowProgressBar progress={0.25} />));

		expect(mockWithTiming).toHaveBeenCalledWith(0.25, {
			duration: 260,
			easing: "cubic",
		});
	});

	test("keeps the existing visible minimum while clamping invalid bounds", async () => {
		const screen = await render(<FlowProgressBar progress={-1} />);
		expect(mockSetProgress).toHaveBeenLastCalledWith(0.07);

		await act(() => screen.rerender(<FlowProgressBar progress={2} />));
		expect(mockWithTiming).toHaveBeenCalledWith(1, expect.any(Object));
	});
});
