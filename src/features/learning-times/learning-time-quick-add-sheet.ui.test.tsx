import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { LearningTimeQuickAddSheet } from "./learning-time-quick-add-sheet";

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
	mockSave.mockResolvedValue(undefined);
});
describe("learning-time quick add", () => {
	test("saves the chosen day without navigating away", async () => {
		const close = jest.fn();
		const screen = await render(<LearningTimeQuickAddSheet onClose={close} />);
		await fireEvent.press(screen.getByRole("radio", { name: "Mittwoch" }));
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockSave).toHaveBeenCalledWith({
			dayOfWeek: 3,
			startTime: "17:00",
			endTime: "17:30",
		});
		expect(close).toHaveBeenCalledTimes(1);
	});
	test("closing without saving does not write a learning time", async () => {
		const close = jest.fn();
		const screen = await render(<LearningTimeQuickAddSheet onClose={close} />);
		await fireEvent.press(screen.getByRole("button", { name: "Schließen" }));
		expect(mockSave).not.toHaveBeenCalled();
		expect(close).toHaveBeenCalledTimes(1);
	});
	test("invalid end time blocks saving", async () => {
		const screen = await render(
			<LearningTimeQuickAddSheet onClose={jest.fn()} />,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Ende: 17:30" }));
		await act(() =>
			mockPicker.onChange({ type: "set" }, new Date(2026, 9, 2, 16, 0)),
		);
		await act(() => mockPicker.onClose());
		expect(screen.getByRole("button", { name: "Speichern" })).toBeDisabled();
		expect(mockSave).not.toHaveBeenCalled();
	});
	test("save failure keeps the editor open and allows retry", async () => {
		mockSave.mockRejectedValueOnce(new Error("offline"));
		const close = jest.fn();
		const screen = await render(<LearningTimeQuickAddSheet onClose={close} />);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(
			screen.getByText(/Die Lernzeit konnte nicht gespeichert werden/),
		).toBeTruthy();
		expect(close).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(close).toHaveBeenCalledTimes(1);
	});
});
