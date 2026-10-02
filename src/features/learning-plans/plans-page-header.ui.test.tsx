import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { PlansPageHeader } from "./plans-page-header";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("~/components/ui/add-icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		AddIcon: ({ outlinedGradient }: { outlinedGradient: boolean }) =>
			React.createElement("Icon", { testID: "add-icon", outlinedGradient }),
	};
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#1A1A1A" } }),
}));

describe("PlansPageHeader", () => {
	test("uses Today's heading scale and shared gradient creation action", async () => {
		const screen = await render(<PlansPageHeader />);
		expect(screen.getByRole("header")).toHaveProp(
			"className",
			expect.stringContaining("text-heading-2"),
		);
		expect(screen.getByRole("header").props.numberOfLines).toBeUndefined();
		expect(screen.getByTestId("add-icon")).toHaveProp("outlinedGradient", true);
		await fireEvent.press(
			screen.getByRole("button", { name: "Lernplan erstellen" }),
		);
		expect(mockPush).toHaveBeenCalledWith(
			expect.stringContaining("/entry/new?type=exam"),
		);
		expect(screen.queryByLabelText("Zurück zu Heute")).toBeNull();
	});

	test("preserves the contextual return action alongside creation", async () => {
		const onBack = jest.fn();
		const screen = await render(<PlansPageHeader onBack={onBack} />);
		await fireEvent.press(screen.getByLabelText("Zurück zu Heute"));
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole("button", { name: "Lernplan erstellen" }),
		).toBeTruthy();
	});
});
