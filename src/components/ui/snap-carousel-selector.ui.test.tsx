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
	test("centers the value and both ring layers on one fixed canvas", async () => {
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
		const valueBubble = screen.getByTestId("snap-carousel-value-bubble");
		const valueLabel = screen.getByTestId("snap-carousel-value-label");

		expect(StyleSheet.flatten(valueBubble.props.style)).toEqual(
			expect.objectContaining({
				height: 88,
				width: 88,
			}),
		);
		expect(StyleSheet.flatten(ring.props.style)).toEqual(
			expect.objectContaining({
				bottom: 0,
				left: 0,
				position: "absolute",
				right: 0,
				top: 0,
			}),
		);
		expect(StyleSheet.flatten(valueLabel.props.style)).toEqual(
			expect.objectContaining({
				bottom: 0,
				left: 0,
				position: "absolute",
				right: 0,
				top: 0,
			}),
		);
		expect(valueLabel.props.className).toEqual(
			expect.stringContaining("items-center justify-center"),
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
