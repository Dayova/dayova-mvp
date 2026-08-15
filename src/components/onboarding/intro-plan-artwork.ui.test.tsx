import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroPlanArtwork } from "./intro-plan-artwork";

jest.mock("expo-linear-gradient", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		LinearGradient: (props: Record<string, unknown>) =>
			React.createElement("LinearGradient", props),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			secondaryText: "#697586",
			surface: "#FFFFFF",
		},
	}),
}));

describe("IntroPlanArtwork", () => {
	test("renders the current shared learning-plan card as decorative artwork", async () => {
		const screen = await render(<IntroPlanArtwork />);
		const hidden = { includeHiddenElements: true };
		const artwork = screen.getByTestId("intro-plan-artwork", hidden);

		expect(artwork.props).toMatchObject({
			accessible: false,
			accessibilityElementsHidden: true,
			importantForAccessibility: "no-hide-descendants",
		});
		expect(screen.getByText("Mathematik", hidden)).toBeOnTheScreen();
		expect(
			screen.getByText("Lineare Funktionen verstehen", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByText("3 nächste Lernschritte", hidden),
		).toBeOnTheScreen();
		expect(screen.queryByRole("button")).toBeNull();
	});

	test("preserves explicit numeric artboard dimensions", async () => {
		const screen = await render(<IntroPlanArtwork width={250} height={144} />);
		const artwork = screen.getByTestId("intro-plan-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork).toHaveStyle({ width: 250, height: 144 });
	});
});
