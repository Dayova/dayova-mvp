import { beforeEach, expect, jest, test } from "@jest/globals";
import { configure, fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";
import { CalendarWeekdays, WeekCalendar } from "./week-calendar";

let mockReducedMotion = false;
const mockTiming = jest.fn();
jest.mock("react-native-reanimated", () => ({
	...jest.requireActual<Record<string, unknown>>(
		"../../../tests/mocks/selection-reanimated.cjs",
	),
	useReducedMotion: () => mockReducedMotion,
	withTiming: (value: number, config: unknown) => {
		mockTiming(value, config);
		return value;
	},
}));
beforeEach(() => {
	mockReducedMotion = false;
	jest.clearAllMocks();
	configure({ defaultIncludeHiddenElements: true });
});

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
	expect(screen.getByTestId("calendar-day-selection-2026-09-29")).toHaveStyle({
		opacity: 0,
	});
	expect(
		screen.getByTestId("calendar-day-circle-2026-09-30").props.className,
	).toContain("bg-button-neutral");
	expect(screen.getByTestId("calendar-day-selection-2026-10-01")).toHaveStyle({
		opacity: 0,
	});
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

test("selected today gets a white number on the branded gradient", async () => {
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
		screen.getByTestId("calendar-day-number-2026-09-29").props.className,
	).toContain("text-white");
	expect(screen.getByTestId("calendar-day-circle-2026-09-29")).toHaveStyle({
		experimental_backgroundImage: `linear-gradient(to bottom, ${DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors[0]}, ${DAYOVA_DESIGN_SYSTEM.gradients.primaryInteractive.colors[1]})`,
	});
	expect(
		screen.getByRole("button", { name: /Dienstag, 29. September, Heute/ }).props
			.accessibilityState.selected,
	).toBe(true);
});

test.each([
	"2026-09-29",
	"2026-09-30",
])("hides dots on selected %s and places other event dots just below the number", async (selectedDayKey) => {
	const screen = await render(
		<WeekCalendar
			weekKey="2026-09-28"
			todayKey="2026-09-29"
			selectedDayKey={selectedDayKey}
			entriesByDay={{
				"2026-09-28": [{ id: "done" as Id<"dayEntries">, completed: true }],
				[selectedDayKey]: [{ id: "open" as Id<"dayEntries"> }],
			}}
			onSelectDay={jest.fn()}
		/>,
	);
	expect(
		screen.getByTestId(`calendar-day-normal-${selectedDayKey}`),
	).toHaveStyle({ opacity: 0 });
	expect(
		screen.getByTestId("calendar-entry-dot-2026-09-28", {
			includeHiddenElements: true,
		}).props.className,
	).toContain("absolute bottom-1");
	expect(
		screen.getByRole("button", { name: /mit Einträgen/, selected: true }),
	).toBeTruthy();
});

test.each([
	false,
	true,
])("selection animates unless reduced motion is %s", async (reduce) => {
	mockReducedMotion = reduce;
	const props = {
		weekKey: "2026-09-28",
		todayKey: "2026-09-29",
		entriesByDay: {},
		onSelectDay: jest.fn(),
	};
	const screen = await render(
		<WeekCalendar {...props} selectedDayKey="2026-09-29" />,
	);
	mockTiming.mockClear();
	await screen.rerender(
		<WeekCalendar {...props} selectedDayKey="2026-09-30" />,
	);
	expect(
		screen.getByRole("button", { selected: true }).props.accessibilityLabel,
	).toContain("30. September");
	if (reduce) expect(mockTiming).not.toHaveBeenCalled();
	else {
		expect(mockTiming).toHaveBeenCalledWith(
			0,
			expect.objectContaining({ duration: 180 }),
		);
		expect(mockTiming).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ duration: 180 }),
		);
	}
});
