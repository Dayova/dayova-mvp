import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { PreparationSlotEditor } from "./preparation-slot-editor";

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
		const React = jest.requireActual<typeof import("react")>("react");
		const { View, Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		React.useEffect(() => {
			if (!visible) onDismiss();
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
});
test("uses weekday circles and begin/end fields without a separate duration selector", async () => {
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
	expect(screen.getByRole("button", { name: "Ende: 17:30" })).toBeOnTheScreen();
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
