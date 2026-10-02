import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { SettingsCard, SettingsSection } from "./settings-list";

jest.mock("~/components/ui/icon", () => ({ ArrowRight: () => null }));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: {} }),
}));

describe("settings group borders", () => {
	test.each([
		"standalone",
		"section",
	])("outlines the %s group with the semantic border without adding shadows", async (kind) => {
		const child = <Text>Test group</Text>;
		const screen = await render(
			kind === "standalone" ? (
				<SettingsCard>{child}</SettingsCard>
			) : (
				<SettingsSection title="Sicherheit & Konto">{child}</SettingsSection>
			),
		);
		const classes = screen
			.getByText("Test group")
			.parent?.props.className.split(/\s+/);
		expect(classes).toEqual(
			expect.arrayContaining([
				"border",
				"border-border",
				"rounded-card",
				"shadow-none",
			]),
		);
		expect(screen.getByText("Test group")).toBeOnTheScreen();
	});
});
