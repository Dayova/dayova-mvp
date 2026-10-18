import { beforeEach, expect, jest, test } from "@jest/globals";
import { configure, fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { CalendarWeekdays, WeekCalendar } from "./week-calendar";

let mockReducedMotion = false;
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
	__esModule: true,
	default: () => ({
		width: 390,
		height: 844,
		scale: 3,
		fontScale: mockFontScale,
	}),
}));
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
	mockFontScale = 1;
	mockReducedMotion = false;
	jest.clearAllMocks();
	configure({ defaultIncludeHiddenElements: true });
});

test("selects a day across the month boundary", async () => {
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

test("shows full weekday labels at large text sizes", async () => {
	mockFontScale = 3;
	const screen = await render(
		<>
			<CalendarWeekdays />
			<WeekCalendar
				weekKey="2026-09-28"
				todayKey="2026-09-29"
				selectedDayKey="2026-09-29"
				entriesByDay={{}}
				onSelectDay={jest.fn()}
			/>
		</>,
	);
	expect(screen.getByText("Montag")).toBeTruthy();
});

test("marks today as the selected accessible day", async () => {
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
		screen.getByRole("button", { name: /Dienstag, 29. September, Heute/ }).props
			.accessibilityState.selected,
	).toBe(true);
});

test.each([
	"2026-09-29",
	"2026-09-30",
])("announces entries on selected %s", async (selectedDayKey) => {
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
		screen.getByRole("button", { name: /mit Einträgen/, selected: true }),
	).toBeTruthy();
});

test.each([
	false,
	true,
])("keeps selection accessible when reduced motion is %s", async (reduce) => {
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
});

test("keeps decorative calendar artwork non-interactive", async () => {
	mockFontScale = 3;
	const screen = await render(
		<WeekCalendar
			mode="artwork"
			weekKey="2026-10-05"
			todayKey="2026-10-05"
			selectedDayKey="2026-10-05"
			entriesByDay={{}}
		/>,
	);
	expect(screen.queryAllByRole("button")).toHaveLength(0);
	expect(mockTiming).not.toHaveBeenCalled();
});
