import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { TimetableWeekEditor } from "./timetable-week-editor";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);

	return {
		ArrowLeft: Icon,
		CalendarDays: Icon,
		Clock3: Icon,
		Trash2: Icon,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			secondaryText: "#697586",
			wrong: "#FF9500",
		},
	}),
}));

const lessons = [
	{
		key: "math",
		dayOfWeek: 1,
		subject: "Mathematik",
		startTime: "08:00",
		endTime: "08:45",
		room: "A1",
	},
	{
		key: "science",
		dayOfWeek: 1,
		subject: "Naturwissenschaften",
		startTime: "08:50",
		endTime: "09:35",
		room: "A2",
	},
	{
		key: "german",
		dayOfWeek: 2,
		subject: "Deutsch",
		startTime: "09:00",
		endTime: "09:45",
		room: "B2",
	},
];

const renderEditor = async (selectedDay = 1) => {
	const callbacks = {
		onSelectedDayChange: jest.fn(),
		onAddLesson: jest.fn(),
		onChangeLesson: jest.fn(),
		onRemoveLesson: jest.fn(),
		onOpenTime: jest.fn(),
		onOpenDayPicker: jest.fn(),
	};
	const screen = await render(
		<TimetableWeekEditor
			lessons={lessons}
			selectedDay={selectedDay}
			isAddDisabled={false}
			{...callbacks}
		/>,
	);

	return { screen, callbacks };
};

describe("TimetableWeekEditor", () => {
	test("navigates by weekday tabs and adds to the visible day", async () => {
		const { screen, callbacks } = await renderEditor();
		const monday = screen.getByRole("button", { name: "Montag, 2 Stunden" });
		const tuesday = screen.getByRole("button", {
			name: "Dienstag, 1 Stunde",
		});

		expect(monday.props.accessibilityState).toEqual({ selected: true });
		expect(tuesday.props.accessibilityState).toEqual({ selected: false });

		await fireEvent.press(tuesday);
		expect(callbacks.onSelectedDayChange).toHaveBeenCalledWith(2);

		await fireEvent.press(
			screen.getByRole("button", {
				name: "Unterrichtsstunde für Montag hinzufügen",
			}),
		);
		expect(callbacks.onAddLesson).toHaveBeenCalledWith(1);
	});

	test("pages horizontally through one lesson card at a time", async () => {
		const { screen } = await renderEditor();
		const pager = screen.getByTestId("timetable-lesson-pager");

		expect(
			screen.queryByText(
				"Wische nach links oder rechts, um die Stunden zu prüfen.",
			),
		).toBeNull();
		expect(pager.props.horizontal).toBe(true);
		expect(pager.props.pagingEnabled).toBe(true);
		expect(screen.getByText("1 / 2")).toBeTruthy();

		await fireEvent(
			screen.getByTestId("timetable-lesson-pager-frame"),
			"layout",
			{ nativeEvent: { layout: { width: 320, height: 500, x: 0, y: 0 } } },
		);
		await fireEvent(pager, "momentumScrollEnd", {
			nativeEvent: { contentOffset: { x: 320, y: 0 } },
		});

		expect(screen.getByText("2 / 2")).toBeTruthy();
	});

	test("keeps weekday correction available without seven controls per card", async () => {
		const { screen, callbacks } = await renderEditor();

		await fireEvent.press(
			screen.getByRole("button", {
				name: "Wochentag für Mathematik ändern. Aktuell Montag",
			}),
		);

		expect(callbacks.onOpenDayPicker).toHaveBeenCalledWith("math");
	});
});
