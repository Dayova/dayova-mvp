import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SnapCarouselSelector } from "./snap-carousel-selector";

jest.mock("react-native-reanimated", () => {
	const ReactNative = require("react-native");
	return {
		__esModule: true,
		default: {
			FlatList: ReactNative.FlatList,
			View: ReactNative.View,
		},
		interpolate: (value: number) => value,
		useAnimatedScrollHandler: (handlers: unknown) => handlers,
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useSharedValue: (initialValue: number) => ({
			get: () => initialValue,
			set: () => undefined,
		}),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			primary: "#00BAFF",
			secondaryText: "#697586",
		},
	}),
}));

describe("SnapCarouselSelector", () => {
	test("pins the progress arc to the same origin as its circular track", async () => {
		const screen = await render(
			<SnapCarouselSelector
				accessibilityLabel="Tägliche Lernzeit"
				accessibilityValue="10 Minuten"
				decrementLabel="Weniger Lernzeit"
				incrementLabel="Mehr Lernzeit"
				items={[10, 20, 30]}
				selectedIndex={0}
				getItemKey={String}
				primaryLabel="10"
				secondaryLabel="Minuten"
				progress={1 / 3}
				onSelect={() => undefined}
			/>,
		);

		const ring = screen.getByTestId("snap-carousel-progress-ring");
		const track = screen.getByTestId("snap-carousel-progress-track");
		const arc = screen.getByTestId("snap-carousel-progress-arc");

		expect(StyleSheet.flatten(ring.props.style)).toEqual(
			expect.objectContaining({
				left: 0,
				position: "absolute",
				top: 0,
			}),
		);
		expect(track.props).toEqual(
			expect.objectContaining({
				cx: arc.props.cx,
				cy: arc.props.cy,
				r: arc.props.r,
				strokeWidth: arc.props.strokeWidth,
			}),
		);
	});
});
