import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { DayovaThemeProvider } from "~/lib/theme";
import { ScreenHeader } from "./screen-header";

jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => {}),
}));

test.each([
	["plain", "Wissenscheck"],
	["compound", ["Wissens", "check"] as const],
] as const)("announces the complete %s title and invokes Back", async (_kind, title) => {
	const onBack = jest.fn();
	const screen = await render(<ScreenHeader title={title} onBack={onBack} />, {
		wrapper: DayovaThemeProvider,
	});
	expect(screen.getByRole("header", { name: "Wissenscheck" })).toBeTruthy();
	expect(
		screen.getByText("Wissenscheck", {
			normalizer: (text) => text.replace(/\p{Cf}/gu, ""),
		}),
	).toBeVisible();
	await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
	expect(onBack).toHaveBeenCalledTimes(1);
});

test("hyphenates a wrapped compound title while announcing the complete word", async () => {
	const screen = await render(
		<ScreenHeader title={["Wissens", "check"]} onBack={() => {}} />,
		{ wrapper: DayovaThemeProvider },
	);
	await fireEvent(screen.getByRole("header"), "textLayout", {
		nativeEvent: { lines: [{ text: "Wissens" }, { text: "check" }] },
	});
	expect(screen.getByText("Wissens- check")).toBeVisible();
	expect(screen.getByRole("header", { name: "Wissenscheck" })).toBeTruthy();
});
