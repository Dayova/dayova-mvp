import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { LearningPlanCardFooter } from "./learning-plan-card-footer";

const mockTiming = jest.fn((value: number, _config?: unknown) => ({
	target: value,
}));
const mockSet = jest.fn();
const mockCancel = jest.fn();
let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		Easing: { cubic: "cubic", out: (value: unknown) => value },
		useReducedMotion: () => mockReducedMotion,
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useSharedValue: (initial: number) => {
			const value = React.useRef(initial);
			return React.useMemo(
				() => ({
					get: () => value.current,
					set: (next: unknown) => {
						mockSet(next);
						if (typeof next === "number") value.current = next;
					},
				}),
				[],
			);
		},
		withTiming: (value: number, config: unknown) => mockTiming(value, config),
		cancelAnimation: () => mockCancel(),
	};
});
beforeEach(() => {
	jest.clearAllMocks();
	mockReducedMotion = false;
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		ClipboardEdit: (props: Record<string, unknown>) =>
			React.createElement(Native.View, props),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { secondaryText: "#697586" },
	}),
}));

describe("LearningPlanCardFooter", () => {
	test("keeps countdown text outside the notched action area", async () => {
		const screen = await render(
			<LearningPlanCardFooter
				progress={40}
				remainingDays={4}
				rollingWindowLabel="2 abgeschlossen · 2 weitere Termine geplant"
			/>,
		);

		const footerStyle = StyleSheet.flatten(
			screen.getByTestId("plan-card-footer").props.style,
		);
		const rollingLabelStyle = StyleSheet.flatten(
			screen.getByText("2 abgeschlossen · 2 weitere Termine geplant").props
				.style,
		);

		expect(footerStyle?.paddingRight ?? 0).toBeGreaterThanOrEqual(32);
		expect(rollingLabelStyle ?? {}).toMatchObject({
			flexGrow: 1,
			flexShrink: 1,
			minWidth: 0,
		});
		expect(screen.getByText("noch 4 Tage").props.numberOfLines).toBe(1);
	});
});

const footer = (progress: number, animateProgress = true) => (
	<LearningPlanCardFooter
		progress={progress}
		animateProgress={animateProgress}
		remainingDays={4}
		rollingWindowLabel="2 abgeschlossen · 2 weitere Termine geplant"
	/>
);

test("starts at saved progress and exposes updates while motion is still pending", async () => {
	const screen = await render(footer(40));
	expect(
		StyleSheet.flatten(
			screen.getByTestId("plan-card-progress-fill").props.style,
		).width,
	).toBe("40%");
	expect(mockTiming).not.toHaveBeenCalled();
	await screen.rerender(footer(60));
	expect(mockTiming).toHaveBeenLastCalledWith(60, {
		duration: 260,
		easing: "cubic",
	});
	expect(
		screen.getByLabelText("60 Prozent abgeschlossen").props.accessibilityValue
			.now,
	).toBe(60);
	await screen.rerender(footer(60));
	expect(mockTiming).toHaveBeenCalledTimes(1);
	await screen.rerender(footer(20));
	expect(mockTiming).toHaveBeenLastCalledWith(20, expect.any(Object));
	expect(mockCancel).toHaveBeenCalledTimes(1);
	await screen.unmount();
	expect(mockCancel).toHaveBeenCalledTimes(2);
});

test.each([
	0, 1, 100,
])("preserves the existing fill at %s percent", async (progress) => {
	const screen = await render(footer(progress));
	expect(
		StyleSheet.flatten(
			screen.getByTestId("plan-card-progress-fill").props.style,
		).width,
	).toBe(`${progress === 1 ? 8 : progress}%`);
	expect(
		screen.getByLabelText(`${progress} Prozent abgeschlossen`).props
			.accessibilityValue.now,
	).toBe(progress);
});

test("reduced motion cancels an in-flight transition and applies the actual value", async () => {
	const screen = await render(footer(20));
	await screen.rerender(footer(40));
	mockReducedMotion = true;
	await screen.rerender(footer(60));
	expect(mockCancel).toHaveBeenCalledTimes(1);
	expect(mockSet).toHaveBeenLastCalledWith(60);
	expect(mockTiming).toHaveBeenCalledTimes(1);
});

test("artwork updates stay static", async () => {
	const screen = await render(footer(20, false));
	await screen.rerender(footer(60, false));
	expect(mockTiming).not.toHaveBeenCalled();
	expect(mockSet).toHaveBeenLastCalledWith(60);
});
