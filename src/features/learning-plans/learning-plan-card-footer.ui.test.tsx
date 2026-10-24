import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { DayovaThemeProvider } from "~/lib/theme";
import { LearningPlanCardFooter } from "./learning-plan-card-footer";

// Native animation stays pending; the real footer must still expose new progress.
jest.mock("react-native-reanimated", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: { View: Native.View },
		Easing: { cubic: () => 0, out: (value: unknown) => value },
		useReducedMotion: () => false,
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useSharedValue: (initial: number) => {
			const value = React.useRef({ get: () => initial, set: () => undefined });
			return value.current;
		},
		withTiming: () => undefined,
		cancelAnimation: () => undefined,
	};
});

const footer = (progress: number) => (
	<DayovaThemeProvider>
		<LearningPlanCardFooter
			progress={progress}
			remainingDays={4}
			rollingWindowLabel="2 abgeschlossen · 2 weitere Termine geplant"
		/>
	</DayovaThemeProvider>
);

// Contract: screen readers receive actual progress without waiting for motion.
// Regression: retaining the mounted value instead of the latest prop must fail.
test("exposes saved progress and reactive updates while native motion is pending", async () => {
	const screen = await render(footer(40));
	expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({
		min: 0,
		max: 100,
		now: 40,
		text: "40 Prozent",
	});
	for (const progress of [60, 20, 0, 100]) {
		await screen.rerender(footer(progress));
		expect(
			screen.getByRole("progressbar", {
				name: `${progress} Prozent abgeschlossen`,
			}),
		).toHaveAccessibilityValue({ now: progress, text: `${progress} Prozent` });
	}
});
