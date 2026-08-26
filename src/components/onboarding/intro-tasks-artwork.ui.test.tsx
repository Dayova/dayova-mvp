import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroTasksArtwork } from "./intro-tasks-artwork";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const icon = (name: string) => (props: Record<string, unknown>) =>
		React.createElement("Icon", { ...props, testID: `${name}-icon` });
	return {
		PropertyEdit: icon("property-edit"),
	};
});

jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: false }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#111111" } }),
}));

describe("IntroTasksArtwork", () => {
	test("renders current shared learning-step cards as one decorative artwork", async () => {
		const screen = await render(<IntroTasksArtwork />);
		const hidden = { includeHiddenElements: true };
		const artwork = screen.getByTestId("intro-tasks-artwork", hidden);

		expect(artwork.props.accessibilityElementsHidden).toBe(true);
		expect(artwork.props.importantForAccessibility).toBe("no-hide-descendants");
		expect(
			screen.getByText("Lineare Funktionen verstehen", hidden),
		).toBeOnTheScreen();
		expect(screen.getByText("Steigung berechnen", hidden)).toBeOnTheScreen();
		expect(
			screen.getByText("Prüfungsaufgaben trainieren", hidden),
		).toBeOnTheScreen();
		expect(screen.getAllByTestId("property-edit-icon", hidden)).toHaveLength(3);
		expect(screen.queryByRole("button", hidden)).toBeNull();
	});

	test("uses the numeric artwork dimensions supplied by the onboarding layout", async () => {
		const screen = await render(<IntroTasksArtwork width={294} height={200} />);
		const artwork = screen.getByTestId("intro-tasks-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork.props.style).toEqual({ width: 294, height: 200 });
	});

	test("centers equal-height cards with one consistent gap", async () => {
		const screen = await render(<IntroTasksArtwork />);
		const hidden = { includeHiddenElements: true };
		const stack = screen.getByTestId("intro-tasks-card-stack", hidden);

		expect(stack.props.className).toContain("w-[336px]");
		expect(stack.props.className).toContain("gap-2");
		for (const index of [1, 2, 3]) {
			expect(
				screen.getByTestId(`intro-task-card-${index}`, hidden).props.className,
			).toContain("h-[72px]");
		}
	});
});
