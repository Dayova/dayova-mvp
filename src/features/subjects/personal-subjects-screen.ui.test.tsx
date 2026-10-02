import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import PersonalSubjectsScreen from "~/app/personal-subjects";

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
const mockSwipeClose = jest.fn();
const mockSheetVisibility: boolean[] = [];
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
	return ({
		children,
		renderRightActions,
	}: {
		children: React.ReactNode;
		renderRightActions: (...args: unknown[]) => React.ReactNode;
	}) => {
		const { View } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<View>
				{children}
				{renderRightActions(null, null, { close: mockSwipeClose })}
			</View>
		);
	};
});
const mockQueryError = new Error(
	"[CONVEX Q(personalSubjects:list)] Server Error",
);
let mockResponse: unknown = mockQueryError;
const mockMutation = jest.fn<(args: { name: string }) => Promise<unknown>>();
beforeEach(() => {
	mockResponse = mockQueryError;
	mockMutation.mockReset();
	mockBack.mockClear();
	mockReplace.mockClear();
	mockCanGoBack = true;
	mockSheetVisibility.length = 0;
});
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQueries: () => ({ subjects: mockResponse }),
	useMutation: () => mockMutation,
}));
jest.mock("expo-router", () => ({
	useRouter: () => ({
		back: mockBack,
		canGoBack: () => mockCanGoBack,
		replace: mockReplace,
	}),
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "blue" } }),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/components/ui/icon", () => ({
	BookOpen: () => null,
	Language: () => null,
	Plus: () => null,
	Pencil: () => null,
	Trash2: () => null,
}));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetInput: jest.requireActual<typeof import("~/components/ui/input")>(
		"~/components/ui/input",
	).Input,
	DayovaSheetFrame: ({
		visible,
		title,
		description,
		children,
	}: {
		visible: boolean;
		title: string;
		description?: string;
		children?: React.ReactNode;
	}) => {
		mockSheetVisibility.push(visible);
		const { View, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<View>
				<Text>{title}</Text>
				<Text>{description}</Text>
				{children}
			</View>
		) : null;
	},
}));
jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheetContent: ({
		onClose,
		onConfirm,
	}: {
		onClose: () => void;
		onConfirm: () => void;
	}) => {
		const { View, Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<View>
				<Text>Löschen bestätigen</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Löschen bestätigen"
					onPress={onConfirm}
				/>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Löschen abbrechen"
					onPress={onClose}
				/>
			</View>
		);
	},
}));
jest.mock("~/components/ui/portrait-content", () => ({
	PortraitContent: ({ children }: { children: React.ReactNode }) => children,
	useContentSizeLayout: () => ({ shouldStackInlineContent: false }),
}));
jest.mock("~/components/ui/screen", () => ({
	Screen: ({ children }: { children: React.ReactNode }) => children,
	ScreenScroll: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/components/screen-header", () => ({
	ScreenHeader: ({
		title,
		onBack,
		right,
	}: {
		title: string;
		onBack: () => void;
		right?: React.ReactNode;
	}) => {
		const { View, Text, Pressable } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<View>
				<Text>{title}</Text>
				{right}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Zurück"
					onPress={onBack}
				/>
			</View>
		);
	},
}));

test("settings displays a recoverable load error instead of crashing or claiming the catalog is empty", async () => {
	const screen = await render(<PersonalSubjectsScreen />);
	expect(screen.getByText("Persönliche Fächer")).toBeOnTheScreen();
	expect(screen.getByRole("alert")).toHaveTextContent(
		/Deine persönlichen Fächer konnten nicht geladen werden/,
	);
	expect(screen.queryByText("Noch keine persönlichen Fächer")).toBeNull();
	expect(screen.queryByRole("progressbar")).toBeNull();
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Zurück" })),
	);
	expect(mockBack).toHaveBeenCalledTimes(1);
});

test("back returns to settings when the screen was opened directly without history", async () => {
	mockCanGoBack = false;
	mockResponse = { personal: [], reusableTimetableSubjects: [] };
	const screen = await render(<PersonalSubjectsScreen />);
	await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
	expect(mockReplace).toHaveBeenCalledWith("/settings");
	expect(mockBack).not.toHaveBeenCalled();
});

test.each([
	"rename",
	"delete",
	"cancel-delete",
])("back still reaches settings after %s", async (action) => {
	mockCanGoBack = false;
	mockResponse = {
		personal: [{ id: "italian-id", name: "Italienisch" }],
		reusableTimetableSubjects: [],
	};
	mockMutation.mockResolvedValue(undefined);
	const screen = await render(<PersonalSubjectsScreen />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Italienisch umbenennen" }),
	);
	if (action === "rename") {
		await fireEvent.changeText(
			screen.getByLabelText("Neuer Fachname"),
			"Italienisch LK",
		);
		await fireEvent.press(screen.getByRole("button", { name: "Speichern" }));
		expect(mockMutation).toHaveBeenCalledWith({
			id: "italian-id",
			name: "Italienisch LK",
		});
	} else {
		await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
		await fireEvent.press(
			screen.getByRole("button", {
				name: action === "delete" ? "Löschen bestätigen" : "Löschen abbrechen",
			}),
		);
	}
	expect(screen.queryByText("Fach bearbeiten")).toBeNull();
	expect(screen.queryByText("Löschen bestätigen")).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
	expect(mockReplace).toHaveBeenCalledWith("/settings");
	expect(mockBack).not.toHaveBeenCalled();
});

test("empty settings offers both the header plus and a first-subject action", async () => {
	mockCanGoBack = false;
	mockResponse = { personal: [], reusableTimetableSubjects: [] };
	mockMutation.mockResolvedValue({
		kind: "personal",
		id: "spanish-id",
		name: "Spanisch",
	});
	const screen = await render(<PersonalSubjectsScreen />);
	expect(
		screen.getByRole("button", { name: "Persönliches Fach hinzufügen" }),
	).toBeOnTheScreen();
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Fach hinzufügen" })),
	);
	await act(() =>
		fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "spanisch"),
	);
	expect(
		screen.queryByRole("button", { name: "Nur diesmal verwenden" }),
	).toBeNull();
	await act(async () => {
		fireEvent.press(
			screen.getAllByRole("button", { name: "Fach hinzufügen" })[1],
		);
	});
	expect(mockMutation).toHaveBeenCalledWith({ name: "Spanisch" });
	expect(screen.queryByText("Fach dauerhaft hinzufügen?")).toBeNull();
	await fireEvent.press(screen.getByRole("button", { name: "Zurück" }));
	expect(mockReplace).toHaveBeenCalledWith("/settings");
});

test("swipe deletion closes the rail and requires confirmation; cancellation does not mutate", async () => {
	mockResponse = {
		personal: [{ id: "italian-id", name: "Italienisch" }],
		reusableTimetableSubjects: [],
	};
	const screen = await render(<PersonalSubjectsScreen />);
	await act(() =>
		fireEvent.press(
			screen.getByRole("button", { name: "Italienisch löschen" }),
		),
	);
	expect(mockSwipeClose).toHaveBeenCalled();
	expect(mockMutation).not.toHaveBeenCalled();
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Löschen abbrechen" })),
	);
	expect(mockMutation).not.toHaveBeenCalled();
	await act(() =>
		fireEvent(
			screen.getByRole("button", { name: "Italienisch umbenennen" }),
			"accessibilityAction",
			{ nativeEvent: { actionName: "delete" } },
		),
	);
	expect(screen.getByText("Löschen bestätigen")).toBeOnTheScreen();
	await act(async () =>
		fireEvent.press(screen.getByRole("button", { name: "Löschen bestätigen" })),
	);
	expect(mockMutation).toHaveBeenCalledWith({ id: "italian-id" });
});

test("the header plus remains available when a personal subject already exists", async () => {
	mockResponse = {
		personal: [{ id: "italian-id", name: "Italienisch" }],
		reusableTimetableSubjects: [],
	};
	const screen = await render(<PersonalSubjectsScreen />);
	expect(screen.queryByText("Noch keine persönlichen Fächer")).toBeNull();
	await act(() =>
		fireEvent.press(
			screen.getByRole("button", { name: "Persönliches Fach hinzufügen" }),
		),
	);
	expect(screen.getByLabelText("Name des Fachs")).toBeOnTheScreen();
});

test("editor keeps the sheet open when switching to deletion confirmation", async () => {
	const subject = { id: "italian-id", name: "Italienisch" };
	mockResponse = { personal: [subject], reusableTimetableSubjects: [] };
	const screen = await render(<PersonalSubjectsScreen />);
	await fireEvent.press(
		screen.getByRole("button", { name: "Italienisch umbenennen" }),
	);
	expect(screen.getByText("Fach bearbeiten")).toBeOnTheScreen();
	await fireEvent.changeText(
		screen.getByLabelText("Neuer Fachname"),
		"Nicht gespeichert",
	);
	expect(screen.getByRole("button", { name: "Speichern" })).toBeOnTheScreen();
	mockSheetVisibility.length = 0;
	await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
	expect(mockSheetVisibility.length).toBeGreaterThan(0);
	expect(mockSheetVisibility.every(Boolean)).toBe(true);
	expect(screen.queryByText("Fach bearbeiten")).toBeNull();
	expect(screen.getByText("Löschen bestätigen")).toBeOnTheScreen();
	expect(mockMutation).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Löschen abbrechen" }),
	);
	expect(mockMutation).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: "Italienisch umbenennen" }),
	);
	await fireEvent.press(screen.getByRole("button", { name: "Löschen" }));
	await fireEvent.press(
		screen.getByRole("button", { name: "Löschen bestätigen" }),
	);
	expect(mockMutation).toHaveBeenCalledTimes(1);
	expect(mockMutation).toHaveBeenCalledWith({ id: subject.id });
});
