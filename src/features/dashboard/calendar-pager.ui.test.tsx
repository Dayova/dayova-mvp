import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text, View } from "react-native";
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

test("preview remains immediate while drag and deceleration wait to commit", async () => {
	const onSelect = jest.fn();
	const onSettled = jest.fn();
	const screen = await render(
		<CalendarPager {...props} onSelect={onSelect} onSettled={onSettled} />,
	);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 240 } },
	});
	expect(onSelect).toHaveBeenLastCalledWith(keys[1]);
	expect(onSettled).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scrollEndDrag", {
		nativeEvent: { contentOffset: { x: 240 }, velocity: { x: 1 } },
	});
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSettled).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSettled).toHaveBeenLastCalledWith(keys[1]);
});

test("aligned no-momentum and non-touch navigation both commit", async () => {
	const onSettled = jest.fn();
	const screen = await render(
		<CalendarPager {...props} onSettled={onSettled} />,
	);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "scrollEndDrag", {
		nativeEvent: { contentOffset: { x: 400 }, velocity: { x: 0 } },
	});
	expect(onSettled).toHaveBeenLastCalledWith(keys[1]);
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	expect(onSettled).toHaveBeenLastCalledWith(keys[2]);
});

test.each([
	false,
	true,
])("an aligned release with velocity waits for quiet; continued scrolling=%s", async (continued) => {
	jest.useFakeTimers();
	try {
		const onSettled = jest.fn();
		const screen = await render(
			<CalendarPager {...props} onSettled={onSettled} />,
		);
		await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
			nativeEvent: { layout: { width: 400 } },
		});
		await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
		await fireEvent(screen.getByTestId("pager"), "scrollEndDrag", {
			nativeEvent: { contentOffset: { x: 400 }, velocity: { x: 1 } },
		});
		expect(onSettled).not.toHaveBeenCalled();
		if (continued)
			await fireEvent(screen.getByTestId("pager"), "scroll", {
				nativeEvent: { contentOffset: { x: 440 } },
			});
		await act(() => jest.advanceTimersByTime(120));
		if (continued) expect(onSettled).not.toHaveBeenCalled();
		else expect(onSettled).toHaveBeenCalledWith(keys[1]);
	} finally {
		jest.useRealTimers();
	}
});

test("non-touch boundary crossings commit only after quiet, and pending commits cancel on unmount", async () => {
	jest.useFakeTimers();
	try {
		const onSettled = jest.fn();
		const screen = await render(
			<CalendarPager {...props} onSettled={onSettled} />,
		);
		await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
			nativeEvent: { layout: { width: 400 } },
		});
		await fireEvent(screen.getByTestId("pager"), "scroll", {
			nativeEvent: { contentOffset: { x: 400 } },
		});
		await act(() => jest.advanceTimersByTime(80));
		await fireEvent(screen.getByTestId("pager"), "scroll", {
			nativeEvent: { contentOffset: { x: 600 } },
		});
		await act(() => jest.advanceTimersByTime(200));
		expect(onSettled).not.toHaveBeenCalled();
		await fireEvent(screen.getByTestId("pager"), "scroll", {
			nativeEvent: { contentOffset: { x: 800 } },
		});
		await act(() => jest.advanceTimersByTime(120));
		expect(onSettled.mock.calls).toEqual([[keys[2]]]);
		await fireEvent(screen.getByTestId("pager"), "scroll", {
			nativeEvent: { contentOffset: { x: 400 } },
		});
		await screen.unmount();
		await act(() => jest.advanceTimersByTime(120));
		expect(onSettled).toHaveBeenCalledTimes(1);
	} finally {
		jest.useRealTimers();
	}
});

test("programmatic acknowledgements do not commit another pager's preview", async () => {
	const onSettled = jest.fn();
	const screen = await render(
		<CalendarPager {...props} onSettled={onSettled} />,
	);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	await screen.rerender(
		<CalendarPager {...props} selectedKey={keys[2]} onSettled={onSettled} />,
	);
	await fireEvent(screen.getByTestId("pager"), "scroll", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 800 } },
	});
	expect(onSettled).not.toHaveBeenCalled();
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSettled).toHaveBeenLastCalledWith(keys[1]);
});

test("quiet settlement calls the latest callback after preview acknowledgement", async () => {
	jest.useFakeTimers();
	try {
		const previous = jest.fn();
		const current = jest.fn();
		const screen = await render(
			<CalendarPager {...props} onSettled={previous} />,
		);
		await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
			nativeEvent: { layout: { width: 400 } },
		});
		await fireEvent(screen.getByTestId("pager"), "scroll", {
			nativeEvent: { contentOffset: { x: 400 } },
		});
		await screen.rerender(
			<CalendarPager {...props} selectedKey={keys[1]} onSettled={current} />,
		);
		await act(() => jest.advanceTimersByTime(120));
		expect(previous).not.toHaveBeenCalled();
		expect(current).toHaveBeenCalledWith(keys[1]);
	} finally {
		jest.useRealTimers();
	}
});

test("neighbor heights reserve transition space only while moving", async () => {
	const screen = await render(
		<CalendarPager
			{...props}
			renderPage={(key) => <View testID={`page-${key}`} />}
		/>,
	);
	await fireEvent(screen.getByTestId("pager-viewport"), "layout", {
		nativeEvent: { layout: { width: 400 } },
	});
	for (const [key, height] of [
		[keys[0], 200],
		[keys[1], 600],
	] as const) {
		const page = screen.getByTestId(`page-${key}`, {
			includeHiddenElements: true,
		}).parent;
		if (!page) throw new Error("Missing measured page wrapper");
		await fireEvent(page, "layout", { nativeEvent: { layout: { height } } });
	}
	expect(screen.getByTestId("pager")).toHaveStyle({ height: 200 });
	await fireEvent(screen.getByTestId("pager"), "scrollBeginDrag");
	expect(screen.getByTestId("pager")).toHaveStyle({ height: 600 });
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 0 } },
	});
	expect(screen.getByTestId("pager")).toHaveStyle({ height: 200 });
});

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
