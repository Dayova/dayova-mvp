import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroTasksArtwork } from "./intro-tasks-artwork";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: (
			jest.requireActual(
				"~/lib/design-system",
			) as typeof import("~/lib/design-system")
		).DAYOVA_DESIGN_SYSTEM.colors,
	}),
}));
jest.mock("~/components/ui/icon", () => {
	const { View } = jest.requireActual(
		"react-native",
	) as typeof import("react-native");
	return { ArrowRight: View, Check: View, Clock3: View };
});

describe("IntroTasksArtwork", () => {
	test("keeps the editorial start graphic decorative and non-interactive", async () => {
		const screen = await render(<IntroTasksArtwork />);
		const hidden = { includeHiddenElements: true };
		const artwork = screen.getByTestId("intro-tasks-artwork", hidden);

		expect(artwork.props.accessibilityElementsHidden).toBe(true);
		expect(artwork.props.importantForAccessibility).toBe("no-hide-descendants");

		expect(screen.getByText("Heute anfangen", hidden)).toBeOnTheScreen();
		expect(screen.getByText("30 Minuten", hidden)).toBeOnTheScreen();
		expect(screen.getByText("Schritt für Schritt", hidden)).toBeOnTheScreen();
		expect(screen.queryByRole("button", hidden)).toBeNull();
	});

	test("uses the numeric artwork dimensions supplied by the onboarding layout", async () => {
		const screen = await render(<IntroTasksArtwork width={294} height={200} />);
		const artwork = screen.getByTestId("intro-tasks-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork.props.style).toEqual({ width: 294, height: 200 });
	});
});
