import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
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

// Native sheet presentation is external to the confirmation action contract.
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		children,
		footer,
	}: {
		children?: ReactNode;
		footer?: ReactNode;
	}) => (
		<>
			{children}
			{footer}
		</>
	),
}));

test.each([
	false,
	true,
])("keeps verification content and blocks unverified confirmation (embedded=%s)", async (embedded) => {
	const onConfirm = jest.fn();
	const onClose = jest.fn();
	const content = (confirmDisabled: boolean) => {
		const props = {
			description: "Bestätige die Löschung mit deinem aktuellen Passwort.",
			confirmLabel: "Konto löschen",
			confirmDisabled,
			onConfirm,
			onClose,
			children: <Text>Passwortprüfung</Text>,
		};
		return embedded ? (
			<ConfirmationSheetContent {...props} />
		) : (
			<ConfirmationSheet {...props} visible title="Konto löschen?" />
		);
	};
	const screen = await render(content(true));
	expect(screen.getByText("Passwortprüfung")).toBeOnTheScreen();
	const confirm = screen.getByRole("button", { name: "Konto löschen" });
	expect(confirm).toBeDisabled();
	await fireEvent.press(confirm);
	expect(onConfirm).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByRole("button", { name: "Abbrechen" }));
	expect(onClose).toHaveBeenCalledTimes(1);
	await screen.rerender(content(false));
	await fireEvent.press(screen.getByRole("button", { name: "Konto löschen" }));
	expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("busy deletion blocks both actions and keeps the failure message visible", async () => {
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
