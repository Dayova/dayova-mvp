import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { MaterialRequiredSheet } from "./material-required-sheet";

jest.mock("~/components/ui/confirmation-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");

	return {
		ConfirmationSheet: ({
			cancelLabel,
			confirmLabel,
			description,
			onClose,
			onConfirm,
			title,
			visible,
		}: {
			cancelLabel: string;
			confirmLabel: string;
			description: import("react").ReactNode;
			onClose: () => void;
			onConfirm: () => void;
			title: import("react").ReactNode;
			visible: boolean;
		}) =>
			visible
				? React.createElement(
						Native.View,
						{ accessibilityViewIsModal: true },
						React.createElement(Native.Text, null, title),
						React.createElement(Native.Text, null, description),
						React.createElement(
							Native.Pressable,
							{ accessibilityRole: "button", onPress: onClose },
							React.createElement(Native.Text, null, cancelLabel),
						),
						React.createElement(
							Native.Pressable,
							{ accessibilityRole: "button", onPress: onConfirm },
							React.createElement(Native.Text, null, confirmLabel),
						),
					)
				: null,
	};
});

describe("MaterialRequiredSheet", () => {
	test("explains the missing material before continuing to upload", async () => {
		const onClose = jest.fn();
		const onUpload = jest.fn();
		const screen = await render(
			<MaterialRequiredSheet
				onClose={onClose}
				onUpload={onUpload}
				subject="Mathe"
				topicDescription={
					"Lineare Funktionen, Steigung berechnen; Nullstellen\nbestimmen"
				}
			/>,
		);

		expect(
			screen.getByText("Für diesen Lernplan fehlt Material"),
		).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Lade mindestens eine Schulunterlage für Mathe hoch.\n\nDafür brauchst du Material:\n• Lineare Funktionen\n• Steigung berechnen\n• Nullstellen\n• bestimmen\n\nDanach kann Dayova deinen Lernplan erstellen.",
			),
		).toBeOnTheScreen();
		fireEvent.press(screen.getByRole("button", { name: "Material hochladen" }));
		expect(onUpload).toHaveBeenCalledTimes(1);
		expect(onClose).not.toHaveBeenCalled();
	});

	test("can be postponed without starting the upload flow", async () => {
		const onClose = jest.fn();
		const onUpload = jest.fn();
		const screen = await render(
			<MaterialRequiredSheet
				onClose={onClose}
				onUpload={onUpload}
				subject="Biologie"
				topicDescription="Zellbiologie"
			/>,
		);

		fireEvent.press(screen.getByRole("button", { name: "Später" }));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onUpload).not.toHaveBeenCalled();
	});

	test("stays closed when no materialless plan is selected", async () => {
		const screen = await render(
			<MaterialRequiredSheet
				onClose={() => undefined}
				onUpload={() => undefined}
				subject={null}
				topicDescription={null}
			/>,
		);

		expect(screen.queryByText("Material hochladen")).toBeNull();
	});
});
