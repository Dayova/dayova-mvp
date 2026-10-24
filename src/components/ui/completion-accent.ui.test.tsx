import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { CompletionAccent } from "./completion-accent";

const mockTiming = jest.fn((value: number) => ({ target: value }));
const mockCancel = jest.fn();
const mockRemove = jest.fn();
let mockMotionChanged: (enabled: boolean) => void;
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		useReducedMotion: () => false,
		useSharedValue: (initial: number) => {
			const value = React.useRef(initial);
			return React.useMemo(
				() => ({
					get: () => value.current,
					set: (next: number | { target: number }) => {
						// Preserve an unfinished native animation through rerenders.
						if (typeof next === "number") value.current = next;
					},
				}),
				[],
			);
		},
		useAnimatedStyle: (factory: () => unknown) => factory(),
		interpolate: () => 0,
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		withTiming: (value: number) => mockTiming(value),
		cancelAnimation: (value: unknown) => mockCancel(value),
	};
});
beforeEach(() => {
	jest.restoreAllMocks();
	jest.clearAllMocks();
	jest
		.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
		.mockResolvedValue(false);
	jest
		.spyOn(AccessibilityInfo, "addEventListener")
		.mockImplementation((_event, listener) => {
			mockMotionChanged = listener as (enabled: boolean) => void;
			return { remove: mockRemove };
		});
});

test("keeps an unfinished accent running through parent updates and cancels on unmount", async () => {
	const screen = await render(<CompletionAccent color="#5856D6" />);
	expect(mockTiming).toHaveBeenCalledTimes(1);
	await screen.rerender(<CompletionAccent color="#AF52DE" />);
	expect(mockTiming).toHaveBeenCalledTimes(1);
	expect(mockCancel).not.toHaveBeenCalled();
	await screen.unmount();
	expect(mockCancel).toHaveBeenCalledTimes(1);
	expect(mockCancel.mock.calls[0]?.[0]).toEqual(
		expect.objectContaining({
			get: expect.any(Function),
			set: expect.any(Function),
		}),
	);
	expect(mockRemove).toHaveBeenCalledTimes(1);
});

test("starts without decoration with reduced motion and never celebrates later", async () => {
	jest
		.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
		.mockResolvedValue(true);
	const screen = await render(<CompletionAccent color="#5856D6" />);
	expect(screen.toJSON()).toBeNull();
	expect(mockTiming).not.toHaveBeenCalled();
	await act(() => mockMotionChanged(false));
	expect(mockTiming).not.toHaveBeenCalled();
});

test("enabling reduced motion hides and cancels an active accent without replaying later", async () => {
	const screen = await render(<CompletionAccent color="#5856D6" />);
	expect(screen.toJSON()).not.toBeNull();
	expect(mockTiming).toHaveBeenCalledTimes(1);
	await act(() => mockMotionChanged(true));
	expect(screen.toJSON()).toBeNull();
	expect(mockCancel).toHaveBeenCalledTimes(1);
	await act(() => mockMotionChanged(false));
	expect(mockTiming).toHaveBeenCalledTimes(1);
});

test("keeps decoration off while the preference is unknown or cannot be read", async () => {
	let rejectPreference!: (error: Error) => void;
	jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
		new Promise((_resolve, reject) => {
			rejectPreference = reject;
		}),
	);
	const screen = await render(<CompletionAccent color="#5856D6" />);
	expect(screen.toJSON()).toBeNull();
	await act(() => rejectPreference(new Error("Unavailable")));
	expect(screen.toJSON()).toBeNull();
	expect(mockTiming).not.toHaveBeenCalled();
});

test("a current accessibility event wins over a stale initial preference", async () => {
	let resolvePreference!: (enabled: boolean) => void;
	jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
		new Promise((resolve) => {
			resolvePreference = resolve;
		}),
	);
	const screen = await render(<CompletionAccent color="#5856D6" />);
	await act(() => mockMotionChanged(true));
	await act(() => resolvePreference(false));
	expect(screen.toJSON()).toBeNull();
	expect(mockTiming).not.toHaveBeenCalled();
});
