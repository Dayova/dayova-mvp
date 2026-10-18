import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Button } from "./button";
import { ConfirmationSheet } from "./confirmation-sheet";
import { Text } from "./text";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { dangerAction: "#B01B10", background: "#F6F6F4" },
	}),
}));
jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: false }),
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		children,
		footer,
	}: {
		children: React.ReactNode;
		footer: React.ReactNode;
	}) => (
		<>
			{children}
			{footer}
		</>
	),
}));

test("outlined subject actions reuse shared tokens and normal wrapping text", async () => {
	const screen = await render(
		<>
			<Button variant="cancel">
				<Text>Abbrechen</Text>
			</Button>
			<Button variant="destructive-outline">
				<Text>Löschen</Text>
			</Button>
		</>,
	);
	expect(
		screen.getByRole("button", { name: "Abbrechen" }).props.className,
	).toContain("bg-card");
	expect(
		screen.getByRole("button", { name: "Abbrechen" }).props.className,
	).toContain("border-border");
	expect(screen.getByText("Abbrechen").props.className).toContain("text-text");
	expect(
		screen.getByRole("button", { name: "Löschen" }).props.className,
	).toContain("border-danger-action");
	expect(
		screen.getByRole("button", { name: "Löschen" }).props.className,
	).toContain("bg-danger-subtle");
	expect(screen.getByText("Löschen").props.className).toContain(
		"text-danger-action",
	);
});

test.each([
	"default",
	"outlined",
] as const)("confirmation appearance %s is opt-in without changing other callers", async (actionAppearance) => {
	const screen = await render(
		<ConfirmationSheet
			visible
			title="Fach löschen?"
			description="Bestehende Einträge bleiben erhalten."
			confirmLabel="Löschen"
			onConfirm={jest.fn()}
			onClose={jest.fn()}
			actionAppearance={actionAppearance}
		/>,
	);
	expect(
		screen.getByRole("button", { name: "Löschen" }).props.className,
	).toContain(
		actionAppearance === "outlined" ? "bg-danger-subtle" : "bg-button-neutral",
	);
	expect(
		screen.getByRole("button", { name: "Abbrechen" }).props.className,
	).toContain(
		actionAppearance === "outlined" ? "bg-card" : "bg-button-neutral",
	);
});
