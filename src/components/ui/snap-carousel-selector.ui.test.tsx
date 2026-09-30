import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import {
	getSnapCarouselPreviewIndex,
	SnapCarouselSelector,
} from "./snap-carousel-selector";

let mockAnimatedScrollHandler:
	| ((event: { contentOffset: { x: number } }) => void)
	| undefined;
let mockReducedMotion = false;
const mockScrollToOffset = jest.fn();
jest.mock("react-native/Libraries/Lists/FlatList", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const RN = jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: React.forwardRef(
			(
				props: import("react-native").ViewProps & {
					data: number[];
					renderItem: (info: {
						item: number;
						index: number;
					}) => import("react").ReactNode;
				},
				ref,
			) => {
				React.useImperativeHandle(ref, () => ({
					scrollToOffset: mockScrollToOffset,
				}));
				return React.createElement(
					RN.View,
					props,
					props.data.map((item, index) =>
						React.createElement(
							React.Fragment,
							{ key: item },
							props.renderItem({ item, index }),
						),
					),
				);
			},
		),
	};
});

jest.mock("react-native-reanimated", () => {
	const ReactNative = require("react-native");
	return {
		__esModule: true,
		default: {
			FlatList: ReactNative.FlatList,
			View: ReactNative.View,
		},
		interpolate: (value: number) => value,
		useReducedMotion: () => mockReducedMotion,
		useAnimatedScrollHandler: (handlers: {
			onScroll: (event: { contentOffset: { x: number } }) => void;
		}) => {
			mockAnimatedScrollHandler = handlers.onScroll;
			return (event: { nativeEvent: { contentOffset: { x: number } } }) =>
				handlers.onScroll(event.nativeEvent);
		},
		useAnimatedStyle: (factory: () => unknown) => factory(),
		useSharedValue: (initialValue: number) => {
			const React = require("react");
			const value = React.useRef(initialValue);
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

jest.mock("react-native-worklets", () => ({
	scheduleOnRN: (
		callback: (...args: unknown[]) => unknown,
		...args: unknown[]
	) => callback(...args),
}));
beforeEach(() => {
	mockReducedMotion = false;
	mockScrollToOffset.mockClear();
});

const selectorProps = {
	accessibilityLabel: "Lernzeit",
	accessibilityValue: "10 Minuten",
	decrementLabel: "Weniger",
	incrementLabel: "Mehr",
	items: [10, 20, 30],
	selectedIndex: 0,
	getItemKey: String,
	primaryLabel: "10",
	secondaryLabel: "Minuten",
	progress: 1 / 3,
};

test("release keeps the preview provisional until the native snap settles", async () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const onSelect = jest.fn();
	function ControlledSelector() {
		const [index, setIndex] = React.useState(0);
		return (
			<SnapCarouselSelector
				{...selectorProps}
				selectedIndex={index}
				onSelect={(item) => {
					onSelect(item);
					setIndex(selectorProps.items.indexOf(item));
				}}
			/>
		);
	}
	const screen = await render(<ControlledSelector />);
	const interval =
		screen.getByTestId("snap-carousel-list").props.snapToInterval;
	mockScrollToOffset.mockClear();
	await fireEvent(screen.getByTestId("snap-carousel-list"), "scrollEndDrag", {
		nativeEvent: { contentOffset: { x: interval * 1.2 }, velocity: { x: 1 } },
	});
	expect(onSelect).not.toHaveBeenCalled();
	expect(mockScrollToOffset).not.toHaveBeenCalled();
	await fireEvent(
		screen.getByTestId("snap-carousel-list"),
		"momentumScrollEnd",
		{
			nativeEvent: { contentOffset: { x: interval * 2 } },
		},
	);
	expect(onSelect).toHaveBeenLastCalledWith(30);
	expect(mockScrollToOffset).not.toHaveBeenCalled();
});

test("an aligned release without momentum commits once, including its duplicate end event", async () => {
	const onSelect = jest.fn();
	const screen = await render(
		<SnapCarouselSelector {...selectorProps} onSelect={onSelect} />,
	);
	const interval =
		screen.getByTestId("snap-carousel-list").props.snapToInterval;
	const event = {
		nativeEvent: { contentOffset: { x: interval }, velocity: { x: 0 } },
	};
	await fireEvent(
		screen.getByTestId("snap-carousel-list"),
		"scrollEndDrag",
		event,
	);
	await fireEvent(
		screen.getByTestId("snap-carousel-list"),
		"momentumScrollEnd",
		event,
	);
	expect(onSelect).toHaveBeenCalledTimes(1);
	expect(onSelect).toHaveBeenCalledWith(20);
});

test.each([
	"stopped",
	"continued",
	"momentum",
	"unmounted",
])("an aligned release with velocity uses a guarded fallback: %s", async (outcome) => {
	jest.useFakeTimers();
	try {
		const onSelect = jest.fn();
		const screen = await render(
			<SnapCarouselSelector {...selectorProps} onSelect={onSelect} />,
		);
		const list = screen.getByTestId("snap-carousel-list");
		const offset = list.props.snapToInterval;
		await fireEvent(list, "scroll", {
			nativeEvent: { contentOffset: { x: offset } },
		});
		await fireEvent(list, "scrollEndDrag", {
			nativeEvent: { contentOffset: { x: offset }, velocity: { x: 1 } },
		});
		expect(onSelect).not.toHaveBeenCalled();
		if (outcome === "continued")
			await fireEvent(list, "scroll", {
				nativeEvent: { contentOffset: { x: offset * 1.2 } },
			});
		if (outcome === "momentum") await fireEvent(list, "momentumScrollBegin");
		if (outcome === "unmounted") await screen.unmount();
		await act(async () => {
			jest.advanceTimersByTime(120);
		});
		if (outcome === "stopped") expect(onSelect).toHaveBeenCalledWith(20);
		else expect(onSelect).not.toHaveBeenCalled();
	} finally {
		jest.useRealTimers();
	}
});

test.each([
	false,
	true,
])("accessibility increments respect reduced motion=%s without a parent echo", async (reduced) => {
	mockReducedMotion = reduced;
	const React = jest.requireActual<typeof import("react")>("react");
	function ControlledSelector() {
		const [index, setIndex] = React.useState(0);
		return (
			<SnapCarouselSelector
				{...selectorProps}
				selectedIndex={index}
				onSelect={(item) => setIndex(selectorProps.items.indexOf(item))}
			/>
		);
	}
	const screen = await render(<ControlledSelector />);
	const interval =
		screen.getByTestId("snap-carousel-list").props.snapToInterval;
	mockScrollToOffset.mockClear();
	await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", {
		nativeEvent: { actionName: "increment" },
	});
	expect(mockScrollToOffset.mock.calls).toEqual([
		[{ offset: interval, animated: !reduced }],
	]);
	if (reduced)
		expect(screen.getByTestId("snap-carousel-tick-1")).toHaveStyle({
			opacity: 1,
			transform: [{ scale: 1 }],
		});
});

describe("SnapCarouselSelector", () => {
	test("derives the live centered item before scrolling settles", () => {
		expect(
			getSnapCarouselPreviewIndex({
				offsetX: 68,
				itemWidth: 68,
				lastIndex: 2,
			}),
		).toBe(1);
		expect(
			getSnapCarouselPreviewIndex({
				offsetX: 35,
				itemWidth: 68,
				lastIndex: 2,
			}),
		).toBe(1);
	});

	test("previews the centered value and ring before scrolling settles", async () => {
		const onSelect = jest.fn();
		const screen = await render(
			<SnapCarouselSelector
				accessibilityLabel="Tägliche Lernzeit"
				accessibilityValue="10 Minuten"
				decrementLabel="Weniger Lernzeit"
				incrementLabel="Mehr Lernzeit"
				items={[10, 20, 30]}
				selectedIndex={0}
				getItemKey={String}
				getItemPrimaryLabel={String}
				getItemProgress={(_, index) => (index + 1) / 3}
				primaryLabel="10"
				secondaryLabel="Minuten"
				progress={1 / 3}
				onSelect={onSelect}
			/>,
		);
		await act(async () => {
			mockAnimatedScrollHandler?.({ contentOffset: { x: 68 } });
		});

		expect(screen.getByText("20")).toBeOnTheScreen();
		expect(
			screen.getByTestId("snap-carousel-progress-arc").props.strokeDasharray,
		).toEqual([String((2 / 3) * 2 * Math.PI * 40), String(2 * Math.PI * 40)]);
		expect(onSelect).not.toHaveBeenCalled();
	});

	test("synchronizes the preview when selection changes externally", async () => {
		const props = {
			accessibilityLabel: "Tägliche Lernzeit",
			accessibilityValue: "10 Minuten",
			decrementLabel: "Weniger Lernzeit",
			incrementLabel: "Mehr Lernzeit",
			items: [10, 20, 30],
			getItemKey: String,
			getItemPrimaryLabel: String,
			getItemProgress: (_item: number, index: number) => (index + 1) / 3,
			secondaryLabel: "Minuten",
			progress: 1 / 3,
			onSelect: jest.fn(),
		};
		const screen = await render(
			<SnapCarouselSelector {...props} selectedIndex={0} primaryLabel="10" />,
		);

		await screen.rerender(
			<SnapCarouselSelector
				{...props}
				accessibilityValue="30 Minuten"
				selectedIndex={2}
				primaryLabel="30"
				progress={1}
			/>,
		);

		expect(screen.getByText("30")).toBeOnTheScreen();
		expect(
			screen.getByTestId("snap-carousel-progress-arc").props.strokeDasharray,
		).toEqual([String(2 * Math.PI * 40), String(2 * Math.PI * 40)]);
	});

	test("centers the value and both ring layers on one responsive canvas", async () => {
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
		const valueBubbleStyle = StyleSheet.flatten(valueBubble.props.style);

		expect(valueBubbleStyle.height).toBe(valueBubbleStyle.width);
		expect(ring.props.height).toBe(valueBubbleStyle.height);
		expect(ring.props.width).toBe(valueBubbleStyle.width);
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
