import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { IntroUploadArtwork } from "./intro-upload-artwork";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			light1: "#FFFFFF",
			primaryAccent: "#4EA7FC",
			primaryStrong: "#2F80ED",
			secondaryText: "#697586",
			surface: "#FFFFFF",
			text: "#101828",
			uploadArtworkBorder: "#D0D5DD",
			uploadArtworkIconBackground: "#F2F4F7",
			uploadArtworkIconBorder: "#D0D5DD",
			uploadArtworkIconFill: "#98A2B3",
			uploadArtworkIconMuted: "#667085",
			uploadArtworkShadow: "#101828",
		},
		isDark: false,
	}),
}));

describe("IntroUploadArtwork", () => {
	test("uses sentence case for the scan instruction", async () => {
		const screen = await render(<IntroUploadArtwork />);
		const renderedLabels =
			screen.root
				?.queryAll((element) => element.type === "RNSVGTSpan")
				.map((label) => label.props.content) ?? [];

		expect(renderedLabels).toContain("oder scanne deine Mitschriften");
		expect(renderedLabels).not.toContain("oder Scanne deine Mitschriften");
	});
});
