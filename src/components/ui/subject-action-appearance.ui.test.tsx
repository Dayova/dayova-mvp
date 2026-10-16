import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Button } from "./button";
import {
	ConfirmationSheet,
	ConfirmationSheetContent,
} from "./confirmation-sheet";
import { Text } from "./text";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { dangerAction: "#B01B10", background: "#F6F6F4" },
	}),
}));
let mockShouldStack = false;
beforeEach(() => {
	mockShouldStack = false;
});
jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: mockShouldStack }),
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
	false,
	true,
])("confirmation uses the common outlined actions (embedded=%s)", async (embedded) => {
	const props = {
		description: "Bestehende Einträge bleiben erhalten.",
		confirmLabel: "Fach löschen",
		onConfirm: jest.fn(),
		onClose: jest.fn(),
	};
	const screen = await render(
		embedded ? (
			<ConfirmationSheetContent {...props} />
		) : (
			<ConfirmationSheet {...props} visible title="Fach löschen?" />
		),
	);
	const confirm = screen.getByRole("button", { name: "Fach löschen" });
	const cancel = screen.getByRole("button", { name: "Abbrechen" });
	expect(confirm.props.className).toContain("bg-danger-subtle");
	expect(cancel.props.className).toContain("bg-card");
	for (const button of [confirm, cancel]) {
		expect(button.props.className).toContain("basis-0");
		expect(button.props.className).toContain("min-h-14");
		expect(button.props.className).toContain("px-3");
	}
	await fireEvent.press(cancel);
	expect(props.onClose).toHaveBeenCalledTimes(1);
	await fireEvent.press(confirm);
	expect(props.onConfirm).toHaveBeenCalledTimes(1);
});

test("primary confirmations keep the primary action and outlined cancel", async () => {
	const screen = await render(
		<ConfirmationSheet
			visible
			title="Änderungen speichern?"
			description="Übernimm deine Änderungen."
			confirmLabel="Speichern"
			confirmTone="primary"
			onConfirm={jest.fn()}
			onClose={jest.fn()}
		/>,
	);
	expect(
		screen.getByRole("button", { name: "Speichern" }).props.className,
	).toContain("bg-primary");
	expect(
		screen.getByRole("button", { name: "Abbrechen" }).props.className,
	).toContain("bg-card");
});

test("busy deletion disables both actions and shows errors", async () => {
	const onConfirm = jest.fn();
	const onClose = jest.fn();
	const screen = await render(
		<ConfirmationSheet
			visible
			title="Konto löschen?"
			description="Dies kann nicht rückgängig gemacht werden."
			confirmLabel="Konto löschen"
			isBusy
			errorMessage="Bitte versuche es erneut."
			onConfirm={onConfirm}
			onClose={onClose}
		/>,
	);
	const confirm = screen.getByRole("button", {
		name: "Konto löschen, wird ausgeführt",
	});
	const cancel = screen.getByRole("button", { name: "Abbrechen" });
	expect(confirm).toBeDisabled();
	expect(cancel).toBeDisabled();
	expect(screen.getByText("Bitte versuche es erneut.")).toBeOnTheScreen();
	await fireEvent.press(confirm);
	await fireEvent.press(cancel);
	expect(onConfirm).not.toHaveBeenCalled();
	expect(onClose).not.toHaveBeenCalled();
});

test("large text keeps long action labels complete in a stacked layout", async () => {
	mockShouldStack = true;
	const screen = await render(
		<ConfirmationSheet
			visible
			title="Lernplan löschen?"
			description="Auch die zugehörigen Lernfortschritte werden entfernt."
			confirmLabel="Lernplan endgültig löschen"
			onConfirm={jest.fn()}
			onClose={jest.fn()}
		/>,
	);
	expect(
		screen.getByTestId("confirmation-actions").props.className,
	).not.toContain("flex-row");
	expect(
		screen.getByRole("button", { name: "Lernplan endgültig löschen" }).props
			.className,
	).toContain("w-full");
	expect(
		screen.getByText("Lernplan endgültig löschen").props.numberOfLines,
	).toBeUndefined();
});
