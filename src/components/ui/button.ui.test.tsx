import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Button } from "./button";
import { Text } from "./text";

describe("Button visual variants", () => {
	test("keeps cancel actions outlined with normal theme text", async () => {
		const screen = await render(
			<Button variant="cancel">
				<Text>Abbrechen</Text>
			</Button>,
		);
		const button = screen.getByRole("button", { name: "Abbrechen" });
		expect(button.props.className).toContain("bg-card");
		expect(button.props.className).toContain("border-border");
		expect(button.props.className).not.toContain("bg-button-neutral");
		expect(screen.getByText("Abbrechen").props.className).toContain(
			"text-text",
		);
	});
	test("uses a red outline, tinted background and red label without a shadow", async () => {
		const screen = await render(
			<Button accessibilityLabel="Eintrag löschen" variant="destructive">
				<Text>Eintrag löschen</Text>
			</Button>,
		);

		const button = screen.getByRole("button", { name: "Eintrag löschen" });
		const label = screen.getByText("Eintrag löschen");
		expect(button.props.className).toContain("bg-danger-subtle");
		expect(button.props.className).toContain("border-danger-action");
		expect(button.props.className).not.toContain("bg-button-neutral");
		expect(button.props.className).not.toContain("shadow-sm");
		expect(label.props.className).toContain("text-danger-action");
	});
});
