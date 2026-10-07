import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { CreateEntryIcon } from "./create-entry-icon";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "#00BAFF" } }),
}));
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Plus: (props: Record<string, unknown>) =>
			React.createElement("Icon", { ...props, testID: "plus" }),
	};
});

test("shares Today's blue glyph size and stroke with plans", async () => {
	const screen = await render(<CreateEntryIcon />);
	expect(screen.getByTestId("plus")).toHaveProp("color", "#00BAFF");
	expect(screen.getByTestId("plus")).toHaveProp("size", 28);
	expect(screen.getByTestId("plus")).toHaveProp("strokeWidth", 1.8);
});
