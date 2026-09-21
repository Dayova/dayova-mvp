import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { DashboardDayHeader } from "./dashboard-day-header";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Plus: (props: Record<string, unknown>) =>
			React.createElement("Icon", { ...props, testID: "plus-icon" }),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primaryStrong: "#009DD8" } }),
}));

describe("DashboardDayHeader", () => {
	test("offers the missing action for adding a plan on an empty day", async () => {
		const onAddPlan = jest.fn();
		const screen = await render(
			<DashboardDayHeader
				agendaLabel="Heute geplant · 0 Termine"
				onAddPlan={onAddPlan}
				showAddPlanAction
				weekday="Donnerstag"
			/>,
		);

		await fireEvent.press(
			screen.getByRole("button", { name: "Lernplan hinzufügen" }),
		);

		expect(onAddPlan).toHaveBeenCalledTimes(1);
	});

	test("hides the add action when the day already contains entries", async () => {
		const screen = await render(
			<DashboardDayHeader
				agendaLabel="Heute geplant · 2 Termine"
				onAddPlan={jest.fn()}
				showAddPlanAction={false}
				weekday="Donnerstag"
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "Lernplan hinzufügen" }),
		).not.toBeOnTheScreen();
	});
});
