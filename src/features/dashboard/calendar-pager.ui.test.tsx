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
	await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
		nativeEvent: { contentOffset: { x: 400 } },
	});
	expect(onSelect).not.toHaveBeenCalled();
});
