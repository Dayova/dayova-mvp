import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroUploadArtwork } from "./intro-upload-artwork";

jest.mock("react-native-keyboard-controller", () => {
	const { View, ScrollView } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return { KeyboardStickyView: View, KeyboardAwareScrollView: ScrollView };
});
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy({}, { get: () => Icon });
});

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../tests/mocks/selection-reanimated.cjs"),
);

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
			screen.getByText("Lade PDFs, Fotos oder andere Dokumente hoch.", hidden),
		).toBeOnTheScreen();
		expect(screen.queryByRole("button", hidden)).toBeNull();
	});
});
