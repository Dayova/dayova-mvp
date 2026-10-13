import { beforeEach, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { CompletionAccent } from "./completion-accent";

let mockReducedMotion = false;
const mockTiming = jest.fn((value: number) => value);
const mockCancel = jest.fn();
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		useReducedMotion: () => mockReducedMotion,
		useSharedValue: (initial: number) => {
			const value = React.useRef(initial);
			return React.useMemo(
				() => ({
					get: () => value.current,
					set: (next: number) => {
						value.current = next;
					},
				}),
				[],
			);
		},
		useAnimatedStyle: (factory: () => unknown) => factory(),
		interpolate: () => 0,
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		withTiming: (value: number) => mockTiming(value),
		cancelAnimation: () => mockCancel(),
	};
});
beforeEach(() => {
	mockReducedMotion = false;
	jest.clearAllMocks();
});

test("runs once and does not replay when its parent updates", async () => {
	const screen = await render(<CompletionAccent color="#5856D6" />);
	expect(mockTiming).toHaveBeenCalledTimes(1);
	await screen.rerender(<CompletionAccent color="#AF52DE" />);
	expect(mockTiming).toHaveBeenCalledTimes(1);
	await screen.unmount();
	expect(mockCancel).toHaveBeenCalledTimes(1);
});

test("reduced motion omits decoration and does not celebrate later when disabled", async () => {
	mockReducedMotion = true;
	const screen = await render(<CompletionAccent color="#5856D6" />);
	expect(screen.toJSON()).toBeNull();
	expect(mockTiming).not.toHaveBeenCalled();
	mockReducedMotion = false;
	await screen.rerender(<CompletionAccent color="#5856D6" />);
	expect(mockTiming).not.toHaveBeenCalled();
});
