import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
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
	test("uses the current theme's secondary text color for inactive labels", async () => {
		const screen = await render(
			<CategoryTabs value="all" onChange={jest.fn()} />,
		);

		expect(screen.getByText("Alle")).toHaveStyle({ color: "#FFFFFF" });
		expect(screen.getByText("Lernpläne")).toHaveStyle({
			color: DARK_SECONDARY_TEXT,
		});
		expect(screen.getByText("Aufgaben")).toHaveStyle({
			color: DARK_SECONDARY_TEXT,
		});
	});
});
