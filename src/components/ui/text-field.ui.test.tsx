import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { InsetTextField } from "./text-field";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00BAFF", text: "#1A1A1A" },
	}),
}));

describe("InsetTextField accessibility", () => {
	test("announces validation errors and exposes them again from the invalid field", async () => {
		const screen = await render(
			<InsetTextField
				label="E-Mail-Adresse"
				invalid
				message="Bitte gib eine gültige E-Mail-Adresse ein."
			/>,
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Bitte gib eine gültige E-Mail-Adresse ein.",
		);
		expect(
			screen.getByLabelText("E-Mail-Adresse").props.accessibilityHint,
		).toBe("Fehler: Bitte gib eine gültige E-Mail-Adresse ein.");
	});
});
