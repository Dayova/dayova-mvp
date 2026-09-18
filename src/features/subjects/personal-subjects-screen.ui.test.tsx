import { expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import PersonalSubjectsScreen from "~/app/personal-subjects";

const mockBack = jest.fn();
const mockQueryError = new Error(
	"[CONVEX Q(personalSubjects:list)] Server Error",
);
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQueries: () => ({ subjects: mockQueryError }),
	useMutation: () => jest.fn(),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primary: "blue" } }),
}));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));
jest.mock("~/components/ui/icon", () => ({ BookOpen: () => null }));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: () => null,
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
	ScreenHeader: ({ title, onBack }: { title: string; onBack: () => void }) => {
		const { View, Text, Pressable } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<View>
				<Text>{title}</Text>
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
