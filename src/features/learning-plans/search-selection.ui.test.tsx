import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { SearchSelectionRow } from "./search-selection";

const mockScrollTo = jest.fn();
const mockScrollToEnd = jest.fn();
let mockReducedMotion = false;

jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		__esModule: true,
		default: function MockScrollView({
			ref,
			...props
		}: Record<string, unknown>) {
			React.useImperativeHandle(ref as React.Ref<unknown>, () => ({
				scrollTo: mockScrollTo,
				scrollToEnd: mockScrollToEnd,
			}));
			return React.createElement("View", props);
		},
	};
});
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("react-native-reanimated", () => ({
	...jest.requireActual<Record<string, unknown>>(
		"../../../tests/mocks/selection-reanimated.cjs",
	),
	useReducedMotion: () => mockReducedMotion,
}));
jest.mock("~/components/ui/icon", () => ({ X: () => null, Check: () => null }));

beforeEach(() => {
	mockScrollTo.mockClear();
	mockScrollToEnd.mockClear();
	mockReducedMotion = false;
});

const row = (count: number) => (
	<SearchSelectionRow count={count} label="Ausgewählte Hinweise">
		<Text>{count} Hinweise</Text>
	</SearchSelectionRow>
);

describe("selected topic and hint scrolling", () => {
	test.each([
		{ contentWidth: 450, offset: 400, expected: 150 },
		{ contentWidth: 200, offset: 400, expected: 0 },
		{ contentWidth: 700, offset: 100, expected: 100 },
	])("keeps remaining chips visible after removal ($contentWidth)", async ({
		contentWidth,
		offset,
		expected,
	}) => {
		const screen = await render(row(3));
		const strip = () => screen.getByLabelText("Ausgewählte Hinweise");
		await fireEvent(strip(), "layout", {
			nativeEvent: { layout: { width: 300 } },
		});
		await fireEvent(strip(), "contentSizeChange", 900, 48);
		await fireEvent.scroll(strip(), {
			nativeEvent: { contentOffset: { x: offset } },
		});
		await screen.rerender(row(2));
		await fireEvent(strip(), "contentSizeChange", contentWidth, 48);
		expect(mockScrollTo).toHaveBeenLastCalledWith({
			x: expected,
			animated: false,
		});
		expect(mockScrollToEnd).not.toHaveBeenCalled();
	});

	test.each([
		false,
		true,
	])("still reveals newly added chips with reduced motion %s", async (reduced) => {
		mockReducedMotion = reduced;
		const screen = await render(row(2));
		const strip = () => screen.getByLabelText("Ausgewählte Hinweise");
		await fireEvent(strip(), "contentSizeChange", 600, 48);
		await screen.rerender(row(3));
		await fireEvent(strip(), "contentSizeChange", 900, 48);
		expect(mockScrollToEnd).toHaveBeenLastCalledWith({ animated: !reduced });
	});
});
