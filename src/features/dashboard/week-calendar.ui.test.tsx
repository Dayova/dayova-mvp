import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { CalendarWeekdays, WeekCalendar } from "./week-calendar";

test("today stays blue when another date is selected; only that date gets a neutral circle", async () => {
	const onSelectDay = jest.fn();
	const screen = await render(
		<WeekCalendar
			weekKey="2026-09-28"
			todayKey="2026-09-29"
			selectedDayKey="2026-09-30"
			entriesByDay={{
				"2026-09-28": [{ id: "done" as Id<"dayEntries">, completed: true }],
			}}
			onSelectDay={onSelectDay}
		/>,
	);
	expect(
		screen.getByTestId("calendar-day-number-2026-09-29").props.className,
	).toContain("text-primary-strong");
	expect(
		screen.getByTestId("calendar-day-circle-2026-09-30").props.className,
	).toContain("bg-button-neutral");
	expect(
		screen.getByTestId("calendar-day-circle-2026-10-01").props.className,
	).toContain("bg-transparent");
	expect(
		screen.getByTestId("calendar-entry-dot-2026-09-28", {
			includeHiddenElements: true,
		}),
	).toBeTruthy();
	await fireEvent.press(
		screen.getByRole("button", { name: /Donnerstag, 1. Oktober/ }),
	);
	expect(onSelectDay).toHaveBeenCalledWith("2026-10-01");
});

test("weekday labels live outside the moving date row", async () => {
	const screen = await render(<CalendarWeekdays />);
	for (const label of ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"])
		expect(screen.getByText(label)).toBeTruthy();
});

test("selected today gets the branded circle", async () => {
	const screen = await render(
		<WeekCalendar
			weekKey="2026-09-28"
			todayKey="2026-09-29"
			selectedDayKey="2026-09-29"
			entriesByDay={{}}
			onSelectDay={jest.fn()}
		/>,
	);
	expect(
		screen.getByTestId("calendar-day-circle-2026-09-29").props.className,
	).toContain("bg-primary");
	expect(
		screen.getByRole("button", { name: /Dienstag, 29. September, Heute/ }).props
			.accessibilityState.selected,
	).toBe(true);
});
