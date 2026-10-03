import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { IntroCalendarArtwork } from "~/components/onboarding/intro-calendar-artwork";
import { WeeklyLearningTimes } from "./weekly-learning-times";

jest.mock("~/components/ui/icon", () => {
	const { View } = jest.requireActual(
		"react-native",
	) as typeof import("react-native");
	return { CalendarDays: View, Clock3: View, ArrowRight: View, Plus: View };
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: (
			jest.requireActual(
				"~/lib/design-system",
			) as typeof import("~/lib/design-system")
		).DAYOVA_DESIGN_SYSTEM.colors,
	}),
}));
const entry = {
	id: "monday",
	dayOfWeek: 1,
	startTime: "16:00",
	endTime: "16:30",
};
describe("WeeklyLearningTimes presentation", () => {
	test("keeps the real editor actions available in screen mode", async () => {
		const onAdd = jest.fn();
		const onEdit = jest.fn();
		const screen = await render(
			<WeeklyLearningTimes entries={[entry]} onAdd={onAdd} onEdit={onEdit} />,
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Weitere Lernzeit für Dienstag hinzufügen",
			}),
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Montag, Lernzeit 16:00 bis 16:30 bearbeiten",
			}),
		);
		expect(onAdd).toHaveBeenCalledWith(2);
		expect(onEdit).toHaveBeenCalledWith(entry);
	});
	test("renders the intro excerpt without exposing inactive controls or duplicate spoken copy", async () => {
		const screen = await render(
			<IntroCalendarArtwork width={320} height={340} />,
		);
		expect(screen.queryByText("Montag")).toBeNull();
		expect(
			screen.getByText("Montag", { includeHiddenElements: true }),
		).toBeOnTheScreen();
		expect(
			screen.getByText("16:00–16:30", { includeHiddenElements: true }),
		).toBeOnTheScreen();
		expect(
			screen.queryAllByRole("button", { includeHiddenElements: true }),
		).toHaveLength(0);
	});
});
