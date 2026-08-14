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
		const monday = screen.getByRole("button", { name: "Montag, 1 Stunde" });
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

	test("changes the visible weekday after a horizontal page swipe", async () => {
		const { screen, callbacks } = await renderEditor();

		await fireEvent(
			screen.getByTestId("timetable-week-pager-frame"),
			"layout",
			{ nativeEvent: { layout: { width: 320, height: 500, x: 0, y: 0 } } },
		);
		await fireEvent(
			screen.getByTestId("timetable-week-pager"),
			"momentumScrollEnd",
			{ nativeEvent: { contentOffset: { x: 320, y: 0 } } },
		);

		expect(callbacks.onSelectedDayChange).toHaveBeenCalledWith(2);
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
