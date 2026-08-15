import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroUploadArtwork } from "./intro-upload-artwork";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primaryStrong: "#2F80ED",
			text: "#101828",
		},
	}),
}));

describe("IntroUploadArtwork", () => {
	test("keeps the shared product preview out of the accessibility tree", async () => {
		const screen = await render(<IntroUploadArtwork />);
		const artwork = screen.getByTestId("intro-upload-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork.props).toEqual(
			expect.objectContaining({
				accessible: false,
				accessibilityElementsHidden: true,
				importantForAccessibility: "no-hide-descendants",
			}),
		);
	});

	test("reuses the current material-upload lead and action copy", async () => {
		const screen = await render(<IntroUploadArtwork />);
		const hidden = { includeHiddenElements: true };

		expect(
			screen.getByText("Schulmaterial hinzufügen", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Deine Unterlagen bilden die Grundlage für deinen Lernplan.",
				hidden,
			),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Schulmaterial hochladen", hidden),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Themenblatt, Arbeitsblätter oder Mitschriften", hidden),
		).toBeOnTheScreen();
		expect(screen.queryByRole("button", hidden)).toBeNull();
	});

	test("uses the numeric artwork dimensions supplied by the onboarding layout", async () => {
		const screen = await render(
			<IntroUploadArtwork width={280} height={254} />,
		);
		const artwork = screen.getByTestId("intro-upload-artwork", {
			includeHiddenElements: true,
		});

		expect(artwork.props.style).toEqual({ width: 280, height: 254 });
	});
});
