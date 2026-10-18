import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { DashboardCalendarHeader } from "./dashboard-calendar-header";

jest.mock("~/components/ui/icon", () => ({ ArrowLeft: () => null }));
jest.mock("~/lib/theme", () => ({ useDayovaTheme: () => ({ colors: {} }) }));
const mockStack = false;
jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: mockStack }),
}));

describe("DashboardCalendarHeader", () => {
	test("shows the selected month and year, including a year boundary", async () => {
		const onToday = jest.fn();
		const screen = await render(
			<DashboardCalendarHeader
				selectedDate={new Date(2026, 11, 31)}
				onToday={onToday}
			/>,
		);
		expect(screen.getByText("Dezember 2026")).toBeTruthy();
		await screen.rerender(
			<DashboardCalendarHeader
				selectedDate={new Date(2027, 0, 1)}
				onToday={onToday}
			/>,
		);
		expect(screen.getByText("Januar 2027")).toBeTruthy();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		await fireEvent.press(screen.getByRole("button", { name: "Heute" }));
		expect(onToday).toHaveBeenCalledTimes(1);
	});
});
