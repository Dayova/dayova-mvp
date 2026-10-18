import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { CalendarPager } from "./calendar-pager";

const mockScroll = jest.fn();
let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => ({
	useReducedMotion: () => mockReducedMotion,
}));
jest.mock("react-native/Libraries/Lists/FlatList", () => {
	const RN = jest.requireActual<typeof import("react-native")>("react-native");
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		__esModule: true,
		default: React.forwardRef(
			(
				props: import("react-native").ViewProps & {
					data: string[];
					renderItem: (info: { item: string }) => import("react").ReactNode;
				},
				ref,
			) => {
				React.useImperativeHandle(ref, () => ({ scrollToOffset: mockScroll }));
				return React.createElement(
					RN.View,
					props,
					props.data.map((item: string) =>
						React.createElement(
							React.Fragment,
							{ key: item },
							props.renderItem({ item }),
						),
					),
				);
			},
		),
	};
});
beforeEach(() => {
	mockScroll.mockClear();
	mockReducedMotion = false;
});
const keys = ["2026-09-30", "2026-10-01", "2026-10-02"];
const props = {
	keys,
	selectedKey: keys[0],
	onSelect: jest.fn(),
	renderPage: (key: string) => <Text>{key}</Text>,
	minimumHeight: 180,
	testID: "pager",
};

test("selection follows the visible page before momentum ends without interrupting the swipe", async () => {
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 160 } },
	});
	expect(onSelect).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 240 } },
	});
	expect(onSelect).toHaveBeenCalledWith(keys[1]);
	await screen.rerender(
		<CalendarPager {...props} onSelect={onSelect} selectedKey={keys[1]} />,
	);
	expect(mockScroll).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 100 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[0]);
});

test("drag compares with the latest committed selection and ignores the same day", async () => {
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await screen.rerender(
		<CalendarPager {...props} onSelect={onSelect} selectedKey={keys[2]} />,
	);
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	expect(onSelect).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 0 } },
	});
	expect(onSelect).toHaveBeenCalledWith(keys[0]);
});

test("native drag selects the settled day across a month boundary", async () => {
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSelect).toHaveBeenCalledWith("2026-10-01");
});

test.each([
	false,
	true,
])("external day selection scrolls the pager; reduced motion=%s", async (reduced) => {
	mockReducedMotion = reduced;
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await screen.rerender(
		<CalendarPager {...props} onSelect={onSelect} selectedKey={keys[2]} />,
	);
	expect(mockScroll).toHaveBeenCalledWith({ offset: 800, animated: !reduced });
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 240 } },
	});
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	expect(onSelect).not.toHaveBeenCalled();
});

test("native scrolling without a touch drag exposes the selected page", async () => {
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[1]);
	await screen.rerender(
		<CalendarPager {...props} onSelect={onSelect} selectedKey={keys[1]} />,
	);
	expect(screen.getByText(keys[1])).toBeTruthy();
	expect(screen.queryByText(keys[0])).toBeNull();
	expect(mockScroll).not.toHaveBeenCalled();
});

test.each([
	false,
	true,
])("native scrolling works after programmatic synchronization; reduced motion=%s", async (reduced) => {
	mockReducedMotion = reduced;
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await screen.rerender(
		<CalendarPager {...props} onSelect={onSelect} selectedKey={keys[2]} />,
	);
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	expect(onSelect).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[1]);
});

test("a native scroll ending before the programmatic target commits its actual page", async () => {
	const onSelect = jest.fn();
	const screen = await render(<CalendarPager {...props} onSelect={onSelect} />);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await screen.rerender(
		<CalendarPager {...props} onSelect={onSelect} selectedKey={keys[2]} />,
	);
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[1]);
});

test("a nonzero initial page ignores setup offsets before accepting native navigation", async () => {
	const onSelect = jest.fn();
	const screen = await render(
		<CalendarPager {...props} selectedKey={keys[2]} onSelect={onSelect} />,
	);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	for (const offset of [0, 800]) {
		await fireEvent(screen.getByTestId("pager"), "scroll", {
			nativeEvent: { contentOffset: { x: offset } },
		});
	}
	expect(onSelect).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[1]);
	expect(mockScroll).not.toHaveBeenCalled();
});

test("a width change preserves the selected page through list remount", async () => {
	const onSelect = jest.fn();
	const screen = await render(
		<CalendarPager {...props} selectedKey={keys[1]} onSelect={onSelect} />,
	);
	for (const width of [400, 360]) {
		await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
			nativeEvent: { layout: { width } },
		});
		for (const offset of [0, width]) {
			await fireEvent(screen.getByTestId("pager"), "scroll", {
				nativeEvent: { contentOffset: { x: offset } },
			});
		}
	}
	expect(onSelect).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 720 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[2]);
});
