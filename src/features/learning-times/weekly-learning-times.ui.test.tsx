import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { WeeklyLearningTimes } from "./weekly-learning-times";

jest.mock("~/components/ui/icon", () => ({
	ArrowRight: () => null,
	Clock3: () => null,
	Plus: () => null,
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00A0E6", secondaryText: "#697586" },
	}),
}));

test("shows the whole week in one compact list and keeps day-specific actions", async () => {
	const onAdd = jest.fn();
	const onEdit = jest.fn();
	const mondayTime = {
		id: "monday-time",
		dayOfWeek: 1,
		startTime: "17:00",
		endTime: "17:30",
	};
	const screen = await render(
		<WeeklyLearningTimes
			entries={[mondayTime]}
			onAdd={onAdd}
			onEdit={onEdit}
		/>,
	);

	expect(screen.getByText("Montag")).toBeOnTheScreen();
	expect(screen.getByText("Sonntag")).toBeOnTheScreen();
	expect(screen.getAllByText("Keine Lernzeit")).toHaveLength(6);
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Montag, Lernzeit 17:00 bis 17:30 bearbeiten",
		}),
	);
	expect(onEdit).toHaveBeenCalledWith(mondayTime);
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Weitere Lernzeit für Dienstag hinzufügen",
		}),
	);
	expect(onAdd).toHaveBeenCalledWith(2);
});
