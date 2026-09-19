import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { WeeklyLearningTimes } from "./weekly-learning-times";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "black" } }),
}));
jest.mock("~/components/ui/icon", () => ({
	Pencil: () => null,
	TimeManagement: () => null,
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

test("shows one clear add action after the last learning time is deleted", async () => {
	const onAdd = jest.fn();
	const screen = await render(
		<WeeklyLearningTimes
			entries={[]}
			onEdit={jest.fn()}
			onRemove={jest.fn()}
			onAdd={onAdd}
		/>,
	);

	expect(screen.getByText("Noch keine Lernzeiten")).toBeTruthy();
	expect(screen.queryByText("Montag")).toBeNull();
	expect(screen.queryByText("Noch keine Lernzeit")).toBeNull();

	await fireEvent.press(
		screen.getByRole("button", { name: "Jetzt Lernzeit hinzufügen" }),
	);
	expect(onAdd).toHaveBeenCalledWith(1);
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
	expect(onAdd).not.toHaveBeenCalled();
	expect(screen.queryByText("Dienstag")).toBeNull();
	expect(screen.queryByText("Noch keine Lernzeit")).toBeNull();
});

test("renders only saved learning times and keeps each entry independent", async () => {
	const entries = [
		{ id: "monday", dayOfWeek: 1, startTime: "17:00", endTime: "17:30" },
		{ id: "friday", dayOfWeek: 5, startTime: "16:00", endTime: "17:00" },
	];
	const onRemove = jest.fn();
	const screen = await render(
		<WeeklyLearningTimes
			entries={entries}
			onEdit={jest.fn()}
			onRemove={onRemove}
			onAdd={jest.fn()}
		/>,
	);

	expect(screen.getByText("Montag")).toBeTruthy();
	expect(screen.getByText("Freitag")).toBeTruthy();
	expect(screen.queryByText("Dienstag")).toBeNull();
	expect(screen.queryByText("Mittwoch")).toBeNull();
	expect(screen.queryByText("Donnerstag")).toBeNull();
	expect(screen.queryByText("Samstag")).toBeNull();
	expect(screen.queryByText("Sonntag")).toBeNull();

	await fireEvent.press(
		screen.getByRole("button", {
			name: "Freitag, Lernzeit 16:00 bis 17:00 löschen",
		}),
	);
	expect(onRemove).toHaveBeenCalledTimes(1);
	expect(onRemove).toHaveBeenCalledWith(entries[1]);
});
