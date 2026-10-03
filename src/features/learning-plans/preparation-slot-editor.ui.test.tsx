import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { PreparationSlotEditor } from "./preparation-slot-editor";

let mockDismissAutomatically = true;
let mockSheetVisibility: boolean[] = [];
let mockDuration: {
	value: number;
	onConfirm: (minutes: number) => void;
	onDismiss: () => void;
};
jest.mock("~/components/ui/duration-picker-sheet", () => ({
	DurationPickerSheet: (props: typeof mockDuration) => {
		mockDuration = props;
		return null;
	},
}));
const mockSave = jest.fn<(...args: unknown[]) => Promise<void>>();
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primary: "#00BAFF",
			surface: "#FFFFFF",
			text: "#1A1A1A",
			onPrimary: "#1A1A1A",
			secondaryText: "#697586",
		},
	}),
}));
let mockPicker: {
	onChange: (event: { type: string }, date: Date) => void;
	onClose: () => void;
};
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => mockSave,
}));
jest.mock("~/lib/user-facing-errors", () => ({
	getUserFacingErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		children,
		footer,
		onClose,
		onDismiss,
	}: {
		visible: boolean;
		children: import("react").ReactNode;
		footer: import("react").ReactNode;
		onClose: () => void;
		onDismiss: () => void;
	}) => {
		mockSheetVisibility.push(visible);
		const React = jest.requireActual<typeof import("react")>("react");
		const { View, Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		React.useEffect(() => {
			if (!visible && mockDismissAutomatically) onDismiss();
		}, [visible, onDismiss]);
		return visible ? (
			<View>
				{children}
				{footer}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Schließen"
					onPress={onClose}
				>
					<Text>Schließen</Text>
				</Pressable>
			</View>
		) : null;
	},
}));
jest.mock("~/components/ui/date-time-picker-sheet", () => ({
	DateTimePickerSheet: (props: typeof mockPicker) => {
		mockPicker = props;
		return null;
	},
}));

beforeEach(() => {
	mockSave.mockReset();
	mockDismissAutomatically = true;
	mockSheetVisibility = [];
});
test("uses weekday circles and begin/end fields with a duration wheel instead of an end-time picker", async () => {
	const save = jest.fn();
	const screen = await render(
		<PreparationSlotEditor
			slot={{
				id: "slot",
				dateKey: "2026-11-08",
				startTime: "17:00",
				durationMinutes: 30,
			}}
			examDateKey="2026-12-31"
			onSave={save}
			onClose={jest.fn()}
			onRemove={jest.fn()}
		/>,
	);
	expect(screen.getAllByRole("radio")).toHaveLength(7);
	expect(
		screen.getByRole("button", { name: "Beginn: 17:00" }),
	).toBeOnTheScreen();
	expect(
		screen.getByRole("button", { name: "Lerndauer: 30 Min." }),
	).toBeOnTheScreen();
	expect(screen.queryByText("Dauer")).toBeNull();
	expect(screen.queryByText(/Minuten ·/)).toBeNull();
	await fireEvent.press(screen.getByRole("radio", { name: "Mittwoch" }));
	await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
	expect(save).toHaveBeenCalledWith({
		id: "slot",
		dateKey: "2026-11-04",
		startTime: "17:00",
		durationMinutes: 30,
	});
});

test("duration confirmation updates the end while keeping the start", async () => {
	const screen = await render(
		<PreparationSlotEditor
			slot={{
				id: "slot",
				dateKey: "2026-11-08",
				startTime: "17:00",
				durationMinutes: 30,
			}}
			examDateKey="2026-12-31"
			onSave={jest.fn()}
			onClose={jest.fn()}
		/>,
	);
	await fireEvent.press(
		screen.getByRole("button", { name: "Lerndauer: 30 Min." }),
	);
	await act(async () => {
		mockDuration.onConfirm(90);
		mockDuration.onDismiss();
	});
	expect(
		screen.getByRole("button", { name: "Lerndauer: 90 Min." }),
	).toBeOnTheScreen();
	expect(
		screen.getByRole("button", { name: "Beginn: 17:00" }),
	).toBeOnTheScreen();
	expect(screen.getByText("Ende 18:30 Uhr")).toBeOnTheScreen();
});

test("opening duration keeps the editor surface mounted without waiting for a dismissal animation", async () => {
	mockDismissAutomatically = false;
	const screen = await render(
		<PreparationSlotEditor
			slot={{
				id: "slot",
				dateKey: "2026-11-08",
				startTime: "17:00",
				durationMinutes: 30,
			}}
			examDateKey="2026-12-31"
			onSave={jest.fn()}
			onClose={jest.fn()}
		/>,
	);
	mockSheetVisibility = [];
	await fireEvent.press(
		screen.getByRole("button", { name: "Lerndauer: 30 Min." }),
	);
	expect(mockSheetVisibility).not.toContain(false);
});

test("time selection stays in the open surface and returns its chosen value", async () => {
	const screen = await render(
		<PreparationSlotEditor
			slot={{
				id: "slot",
				dateKey: "2026-11-08",
				startTime: "17:00",
				durationMinutes: 30,
			}}
			examDateKey="2026-12-31"
			onSave={jest.fn()}
			onClose={jest.fn()}
		/>,
	);
	mockDismissAutomatically = false;
	mockSheetVisibility = [];
	await fireEvent.press(screen.getByRole("button", { name: "Beginn: 17:00" }));
	await act(async () =>
		mockPicker.onChange({ type: "set" }, new Date("2026-11-08T18:15:00")),
	);
	await act(async () => mockPicker.onClose());
	expect(mockSheetVisibility).not.toContain(false);
	expect(
		screen.getByRole("button", { name: "Beginn: 18:15" }),
	).toBeOnTheScreen();
});
test("editing offers remove beside save, without a duplicate cancel action", async () => {
	const remove = jest.fn();
	const save = jest.fn();
	const screen = await render(
		<PreparationSlotEditor
			slot={{
				id: "slot",
				dateKey: "2026-11-08",
				startTime: "17:00",
				durationMinutes: 30,
			}}
			examDateKey="2026-12-31"
			onSave={save}
			onClose={jest.fn()}
			onRemove={remove}
		/>,
	);
	expect(screen.queryByRole("button", { name: "Abbrechen" })).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Entfernen" }));
	expect(remove).toHaveBeenCalledTimes(1);
	expect(save).not.toHaveBeenCalled();
});
