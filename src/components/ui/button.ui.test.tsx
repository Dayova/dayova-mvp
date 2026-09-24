import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Button } from "./button";
import { Text } from "./text";

describe("Button visual variants", () => {
	test("keeps destructive actions red with white labels and no shadow", async () => {
		const screen = await render(
			<Button accessibilityLabel="Eintrag löschen" variant="destructive">
				<Text>Eintrag löschen</Text>
			</Button>,
		);

		const button = screen.getByRole("button", { name: "Eintrag löschen" });
		const label = screen.getByText("Eintrag löschen");
		expect(button.props.className).toContain("bg-destructive");
		expect(button.props.className).not.toContain("bg-button-neutral");
		expect(button.props.className).not.toContain("shadow-sm");
		expect(label.props.className).toContain("text-white");
	});
});
