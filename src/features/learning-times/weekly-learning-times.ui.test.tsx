import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { WeeklyLearningTimes } from "./weekly-learning-times";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "black" } }),
}));
jest.mock("~/components/ui/icon", () => ({
	Pencil: () => null,
	Trash2: () => null,
}));
// Expose native swipe actions to verify row-to-entry wiring, not the gesture animation.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return ({
		children,
		renderRightActions,
	}: {
		children: React.ReactNode;
		renderRightActions: (
			a: unknown,
			b: unknown,
			methods: { close: () => void },
		) => React.ReactNode;
	}) => (
		<View>
			{children}
			{renderRightActions(null, null, { close: jest.fn() })}
		</View>
	);
});
test("edits and removes the correct slot when a day has multiple learning times", async () => {
	const entries = [
		{ id: "first", dayOfWeek: 1, startTime: "15:00", endTime: "16:00" },
		{ id: "second", dayOfWeek: 1, startTime: "17:00", endTime: "18:00" },
	];
	const onEdit = jest.fn();
	const onRemove = jest.fn();
	const onAdd = jest.fn();
	const screen = await render(
		<WeeklyLearningTimes
			entries={entries}
			onEdit={onEdit}
			onRemove={onRemove}
			onAdd={onAdd}
		/>,
	);
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Montag, Lernzeit 17:00 bis 18:00 bearbeiten",
		}),
	);
	expect(onEdit).toHaveBeenCalledWith(entries[1]);
	await fireEvent.press(
		screen.getByRole("button", {
			name: "Montag, Lernzeit 15:00 bis 16:00 löschen",
		}),
	);
	expect(onRemove).toHaveBeenCalledWith(entries[0]);
	await fireEvent.press(
		screen.getByRole("button", { name: "Lernzeit für Dienstag hinzufügen" }),
	);
	expect(onAdd).toHaveBeenCalledWith(2);
	expect(
		screen.queryByRole("button", { name: /Dienstag.*löschen/ }),
	).toBeNull();
});
