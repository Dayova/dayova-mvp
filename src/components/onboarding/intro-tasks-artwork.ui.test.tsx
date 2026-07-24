import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroTasksArtwork } from "./intro-tasks-artwork";

jest.mock("expo-linear-gradient", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		LinearGradient: (props: Record<string, unknown>) =>
			React.createElement("LinearGradient", props),
	};
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const icon = (name: string) => (props: Record<string, unknown>) =>
		React.createElement("Icon", { ...props, testID: `${name}-icon` });
	return {
		Check: icon("check"),
		ClipboardEdit: icon("clipboard-edit"),
		Fire: icon("fire"),
	};
});

describe("IntroTasksArtwork", () => {
	test("renders the maintained task preview as one decorative artwork", async () => {
		const screen = await render(<IntroTasksArtwork />);
		const hidden = { includeHiddenElements: true };
		const artwork = screen.getByTestId("intro-tasks-artwork", hidden);

		expect(artwork.props.accessibilityElementsHidden).toBe(true);
		expect(artwork.props.importantForAccessibility).toBe("no-hide-descendants");
		expect(screen.getByText("Hausaufgabe Mathe", hidden)).toBeOnTheScreen();
		expect(screen.getByText("Deutsch Vortrag", hidden)).toBeOnTheScreen();
		expect(
			screen.getByText("Geschichte Test lernen", hidden),
		).toBeOnTheScreen();

		expect(screen.getByTestId("fire-icon", hidden).props).toMatchObject({
			color: "#FFFFFF",
			size: 14,
			strokeWidth: 1.5,
		});
	});
});
