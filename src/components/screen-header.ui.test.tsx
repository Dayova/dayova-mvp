import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "~/components/ui/text";
import { ScreenHeader } from "./screen-header";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#1A1A1A" } }),
}));
jest.mock("~/components/ui/icon", () => ({ ArrowLeft: () => null }));

let mockDimensions = { width: 393, height: 852, scale: 3, fontScale: 1.15 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
	__esModule: true,
	default: () => mockDimensions,
}));
beforeEach(() => {
	mockDimensions = {
		width: 393,
		height: 852,
		scale: 3,
		fontScale: 1.15,
	};
});

test("keeps the whole session title and back action available", async () => {
	const onBack = jest.fn();
	const screen = await render(
		<ScreenHeader
			title="Wissenscheck"
			onBack={onBack}
			titleClassName="text-body-1"
		/>,
	);
	expect(screen.getByRole("header").props.numberOfLines).toBeUndefined();
	await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
	expect(onBack).toHaveBeenCalledTimes(1);
});

test("moves a title that wraps into its own full-width row", async () => {
	const screen = await render(
		<ScreenHeader
			title="Wissenscheck"
			onBack={() => {}}
			right={<Text>12:34</Text>}
		/>,
	);
	await fireEvent(screen.getByRole("header"), "textLayout", {
		nativeEvent: { lines: [{ text: "Wissens" }, { text: "check" }] },
	});
	expect(screen.getByRole("header").props.style).toEqual(
		expect.arrayContaining([expect.objectContaining({ paddingHorizontal: 0 })]),
	);
	expect(screen.getByText("12:34")).toBeTruthy();
});

test("rechecks title fit after system text size changes", async () => {
	const props = { title: "Wissenscheck", onBack: () => {} };
	const screen = await render(<ScreenHeader {...props} />);
	await fireEvent(screen.getByRole("header"), "textLayout", {
		nativeEvent: { lines: [{ text: "Wissens" }, { text: "check" }] },
	});
	mockDimensions = {
		width: 393,
		height: 852,
		scale: 3,
		fontScale: 1,
	};
	// The dimensions stub has no native subscription; invalidate the compiler's
	// unchanged-props memo so it reads the new system sizing.
	await screen.rerender(<ScreenHeader {...props} className="mb-0" />);
	expect(screen.getByRole("header").props.style).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ paddingHorizontal: 60 }),
		]),
	);
});

test("gives enlarged text the full title width without shrinking it", async () => {
	mockDimensions = {
		width: 320,
		height: 640,
		scale: 3,
		fontScale: 2,
	};
	const screen = await render(
		<ScreenHeader
			title="Wissenscheck"
			onBack={() => {}}
			titleClassName="px-24 text-body-1"
		/>,
	);
	expect(screen.getByRole("header").props.style).toEqual(
		expect.arrayContaining([expect.objectContaining({ paddingHorizontal: 0 })]),
	);
	expect(screen.getByRole("header").props.maxFontSizeMultiplier).toBe(1.75);
	expect(screen.getByRole("header").props.adjustsFontSizeToFit).toBeUndefined();
});

test("keeps a compound title beside back when its complete parts fit", async () => {
	mockDimensions = { width: 320, height: 640, scale: 3, fontScale: 2 };
	const screen = await render(
		<ScreenHeader title={["Wissens", "check"]} onBack={() => {}} />,
	);
	await fireEvent(screen.getByRole("header"), "textLayout", {
		nativeEvent: { lines: [{ text: "Wissens\u200b" }, { text: "check" }] },
	});
	expect(screen.getByRole("header").props.style).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ paddingHorizontal: 60 }),
		]),
	);
	expect(screen.getByRole("header").props.accessibilityLabel).toBe(
		"Wissenscheck",
	);
});

test("gives compound titles more room rather than fragmenting their parts", async () => {
	mockDimensions = { width: 280, height: 640, scale: 3, fontScale: 2 };
	const screen = await render(
		<ScreenHeader title={["Wissens", "check"]} onBack={() => {}} />,
	);
	await fireEvent(screen.getByRole("header"), "textLayout", {
		nativeEvent: {
			lines: [{ text: "Wisse" }, { text: "ns" }, { text: "check" }],
		},
	});
	expect(screen.getByRole("header").props.style).toEqual(
		expect.arrayContaining([expect.objectContaining({ paddingHorizontal: 0 })]),
	);
	expect(screen.getByRole("header").props.children).toBe("Wissens\ncheck");
});
