import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { SEMANTIC_HEADING_MAX_FONT_SIZE_MULTIPLIER } from "~/lib/content-size-layout";
import { Text } from "./text";

describe("Text content-size behavior", () => {
	test("uses the shared native-style scaling cap for semantic headings", async () => {
		const screen = await render(
			<>
				<Text accessibilityRole="header">Onboarding-Frage</Text>
				<Text variant="h1">Testphase</Text>
			</>,
		);

		expect(screen.getByText("Onboarding-Frage")).toHaveProp(
			"maxFontSizeMultiplier",
			SEMANTIC_HEADING_MAX_FONT_SIZE_MULTIPLIER,
		);
		expect(screen.getByText("Testphase")).toHaveProp(
			"maxFontSizeMultiplier",
			SEMANTIC_HEADING_MAX_FONT_SIZE_MULTIPLIER,
		);
	});

	test("keeps body copy on the user's full text-size preference", async () => {
		const screen = await render(<Text>Voll skalierbarer Erklärungstext</Text>);

		expect(screen.getByText("Voll skalierbarer Erklärungstext")).not.toHaveProp(
			"maxFontSizeMultiplier",
		);
	});
});
