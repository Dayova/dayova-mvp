import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import PersonalSubjectsScreen from "~/app/personal-subjects";

const mockBack = jest.fn();
const mockQueryError = new Error(
	"[CONVEX Q(personalSubjects:list)] Server Error",
);
let mockResponse: unknown = mockQueryError;
const mockMutation = jest.fn<(args: { name: string }) => Promise<unknown>>();
beforeEach(() => {
	mockResponse = mockQueryError;
	mockMutation.mockReset();
	mockBack.mockClear();
});
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQueries: () => ({ subjects: mockResponse }),
	useMutation: () => mockMutation,
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "blue" } }),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/components/ui/icon", () => ({
	BookOpen: () => null,
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
	ConfirmationSheet: () => null,
}));
jest.mock("~/components/ui/portrait-content", () => ({
	PortraitContent: ({ children }: { children: React.ReactNode }) => children,
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

test("empty settings offers both the header plus and a first-subject action", async () => {
	mockResponse = { personal: [], reusableTimetableSubjects: [] };
	mockMutation.mockResolvedValue({
		kind: "personal",
		id: "spanish-id",
		name: "Spanisch",
	});
	const screen = await render(<PersonalSubjectsScreen />);
	const actions = screen.getAllByRole("button", {
		name: "Persönliches Fach hinzufügen",
	});
	expect(actions).toHaveLength(2);
	await act(() => fireEvent.press(actions[1]));
	await act(() =>
		fireEvent.changeText(screen.getByLabelText("Name des Fachs"), "spanisch"),
	);
	await act(() =>
		fireEvent.press(screen.getByRole("button", { name: "Weiter" })),
	);
	expect(
		screen.queryByRole("button", { name: "Nur diesmal verwenden" }),
	).toBeNull();
	await act(async () => {
		fireEvent.press(
			screen.getByRole("button", { name: "Dauerhaft hinzufügen" }),
		);
	});
	expect(mockMutation).toHaveBeenCalledWith({ name: "Spanisch" });
	expect(screen.queryByText("Fach dauerhaft hinzufügen?")).toBeNull();
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
