import { expect, jest, test } from "@jest/globals";
import {
	fireEvent,
	render as renderNative,
} from "@testing-library/react-native";
import type { ReactElement } from "react";
import { InlineDatePicker } from "./inline-date-picker.ios";

async function render(element: ReactElement) {
	const screen = await renderNative(element);
	await fireEvent(screen.getByTestId("calendar-viewport"), "layout", {
		nativeEvent: { layout: { width: 350 } },
	});
	return screen;
}

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			text: "#FFFFFF",
			secondaryText: "#999999",
			onPrimary: "#111111",
		},
	}),
}));
jest.mock("~/components/ui/icon", () => ({
	ArrowLeft: () => null,
	ArrowRight: () => null,
	ChevronDown: () => null,
}));

test("selects the initial month and preserves the selected date while browsing other months", async () => {
	const onChange = jest.fn();
	const screen = await render(
		<InlineDatePicker value={new Date(2026, 10, 25)} onChange={onChange} />,
	);
	expect(
		screen.getByRole("button", { name: "Mittwoch, 25. November 2026" }),
	).toBeSelected();
	await fireEvent.press(
		screen.getByRole("button", { name: "Freitag, 13. November 2026" }),
	);
	expect(onChange).toHaveBeenCalledWith(new Date(2026, 10, 13));
	await screen.rerender(
		<InlineDatePicker value={new Date(2026, 10, 13)} onChange={onChange} />,
	);
	expect(
		screen.getByRole("button", { name: "Freitag, 13. November 2026" }),
	).toBeSelected();
	await fireEvent.press(screen.getByRole("button", { name: "Nächster Monat" }));
	expect(screen.getByText("Dezember 2026")).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Donnerstag, 31. Dezember 2026" }),
	).toBeEnabled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Vorheriger Monat" }),
	);
	expect(
		screen.getByRole("button", { name: "Freitag, 13. November 2026" }),
	).toBeSelected();
	expect(onChange).toHaveBeenCalledTimes(1);
});

test("includes local boundary days while disabling out-of-range days and months", async () => {
	const onChange = jest.fn();
	const screen = await render(
		<InlineDatePicker
			value={new Date(2026, 10, 25)}
			minimumDate={new Date(2026, 10, 12, 16)}
			maximumDate={new Date(2026, 10, 26, 8)}
			onChange={onChange}
		/>,
	);
	expect(
		screen.getByRole("button", { name: "Vorheriger Monat" }),
	).toBeDisabled();
	expect(screen.getByRole("button", { name: "Nächster Monat" })).toBeDisabled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Mittwoch, 11. November 2026" }),
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Freitag, 27. November 2026" }),
	);
	expect(onChange).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Donnerstag, 12. November 2026" }),
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Donnerstag, 26. November 2026" }),
	);
	expect(onChange.mock.calls.map(([date]) => date)).toEqual([
		new Date(2026, 10, 12),
		new Date(2026, 10, 26),
	]);
	await fireEvent.press(
		screen.getByRole("button", { name: "Monat und Jahr auswählen" }),
	);
	expect(screen.getByRole("button", { name: "Oktober 2026" })).toBeDisabled();
	expect(screen.getByRole("button", { name: "Dezember 2026" })).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Vorheriges Jahr" }),
	).toBeDisabled();
	expect(screen.getByRole("button", { name: "Nächstes Jahr" })).toBeDisabled();
});

test("supports year rollover, leap days, month selection and external date updates", async () => {
	const onChange = jest.fn();
	const screen = await render(
		<InlineDatePicker value={new Date(2027, 11, 31)} onChange={onChange} />,
	);
	await fireEvent.press(screen.getByRole("button", { name: "Nächster Monat" }));
	expect(screen.getByText("Januar 2028")).toBeTruthy();
	await fireEvent.press(
		screen.getByRole("button", { name: "Monat und Jahr auswählen" }),
	);
	await fireEvent.press(screen.getByRole("button", { name: "Februar 2028" }));
	await fireEvent.press(
		screen.getByRole("button", { name: "Dienstag, 29. Februar 2028" }),
	);
	expect(onChange).toHaveBeenCalledWith(new Date(2028, 1, 29));
	await screen.rerender(
		<InlineDatePicker value={new Date(2029, 3, 1)} onChange={onChange} />,
	);
	await fireEvent(screen.getByTestId("calendar-viewport"), "layout", {
		nativeEvent: { layout: { width: 350 } },
	});
	expect(screen.getByText("April 2029")).toBeTruthy();
	expect(
		screen.getByRole("button", { name: "Sonntag, 1. April 2029" }),
	).toBeSelected();
});
