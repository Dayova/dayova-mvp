import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { CategoryTabs } from "./category-tabs";

const DARK_SECONDARY_TEXT = "#A8ACB7";

jest.mock("react-native-reanimated", () => {
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	const transition = {
		damping: () => transition,
		stiffness: () => transition,
	};

	return {
		__esModule: true,
		default: { Text: Native.Text, View: Native.View },
		Easing: {
			cubic: jest.fn(),
			out: (value: unknown) => value,
		},
		FadeOut: { duration: () => ({}) },
		LinearTransition: { springify: () => transition },
		interpolate: jest.fn(),
		interpolateColor: (
			progress: number,
			_inputRange: number[],
			outputRange: string[],
		) => (progress === 0 ? outputRange[0] : outputRange[1]),
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useSharedValue: (initialValue: number) => {
			let currentValue = initialValue;
			return {
				get: () => currentValue,
				set: (value: number) => {
					currentValue = value;
				},
			};
		},
		withSpring: (value: number) => value,
		withTiming: (value: number) => value,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { secondaryText: DARK_SECONDARY_TEXT },
	}),
}));

describe("notification category tabs", () => {
	test("selects the requested notification category and reflects controlled updates", async () => {
		const onChange = jest.fn();
		const screen = await render(
			<CategoryTabs value="all" onChange={onChange} />,
		);
		expect(
			screen.getByRole("tab", { name: "Alle", selected: true }),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("tab", { name: "Lernpläne" }));
		expect(onChange).toHaveBeenCalledWith("learningPlan");
		await screen.rerender(
			<CategoryTabs value="learningPlan" onChange={onChange} />,
		);
		expect(
			screen.getByRole("tab", { name: "Lernpläne", selected: true }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("tab", { name: "Alle", selected: false }),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("tab", { name: "Aufgaben" }));
		expect(onChange).toHaveBeenLastCalledWith("task");
	});
});
