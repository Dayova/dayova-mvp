import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { MaterialUpdatePanel } from "./material-update-panel";

test("shows an explicit update action only for pending material", async () => {
	const apply = jest.fn();
	const screen = await render(
		<MaterialUpdatePanel pending busy={false} result={null} onApply={apply} />,
	);
	expect(
		screen.getByText("Material gespeichert. Lernplan noch nicht aktualisiert."),
	).toBeOnTheScreen();
	await fireEvent.press(
		screen.getByRole("button", { name: "Lernplan aktualisieren" }),
	);
	expect(apply).toHaveBeenCalledTimes(1);
	await screen.rerender(
		<MaterialUpdatePanel
			pending={false}
			busy={false}
			result="2 Lernblöcke aktualisiert."
			additionalMinutes={20}
			onApply={apply}
		/>,
	);
	expect(
		screen.queryByRole("button", {
			name: "Lernplan aktualisieren",
		}),
	).toBeNull();
	expect(screen.getByText("2 Lernblöcke aktualisiert.")).toBeOnTheScreen();
	expect(screen.getByText(/20 zusätzliche Minuten/)).toBeOnTheScreen();
});

test("disables repeated requests and keeps errors and retry visible", async () => {
	const apply = jest.fn();
	const screen = await render(
		<MaterialUpdatePanel pending busy result={null} onApply={apply} />,
	);
	const button = screen.getByRole("button", {
		name: "Lernplan aktualisieren",
	});
	expect(button).toBeDisabled();
	await fireEvent.press(button);
	expect(apply).not.toHaveBeenCalled();
	await screen.rerender(
		<MaterialUpdatePanel
			pending
			busy={false}
			error="Aktualisierung fehlgeschlagen. Inhalte bleiben erhalten."
			result={null}
			onApply={apply}
		/>,
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		/Inhalte bleiben erhalten/,
	);
	expect(
		screen.getByRole("button", { name: "Lernplan aktualisieren" }),
	).toBeEnabled();
});

test("shows preservation details on demand without applying material", async () => {
	const apply = jest.fn();
	const screen = await render(
		<MaterialUpdatePanel pending busy={false} result={null} onApply={apply} />,
	);
	expect(screen.queryByText(/Nur noch nicht begonnene/)).toBeNull();
	const details = screen.getByRole("button", {
		name: "Was wird aktualisiert?",
	});
	expect(details.props.accessibilityState).toMatchObject({ expanded: false });
	await fireEvent.press(details);
	expect(
		screen.getByText(/Fortschritt und Termine bleiben erhalten/),
	).toBeOnTheScreen();
	expect(apply).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Details ausblenden" }),
	);
	expect(screen.queryByText(/Nur noch nicht begonnene/)).toBeNull();
});
