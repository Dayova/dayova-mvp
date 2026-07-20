import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
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

	test("keeps an accessoried field single-line and vertically centered", async () => {
		const screen = await render(
			<InsetTextField
				accessory={<Text testID="field-accessory">Auge</Text>}
				label="Neues Passwort"
			/>,
		);

		const input = screen.getByLabelText("Neues Passwort");
		expect(input.props.multiline).toBe(false);
		expect(input.props.numberOfLines).toBe(1);
		expect(input.parent?.props.className).toContain("justify-center");
		expect(screen.getByTestId("field-accessory")).toBeOnTheScreen();
	});
});
