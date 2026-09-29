import { expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import LearningTimesOverviewScreen from "~/app/learning-times";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, back: jest.fn() }),
	useLocalSearchParams: () => ({}),
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => [],
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "test-user" } }),
}));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { primary: "#00A0E6", secondaryText: "#697586" },
	}),
}));
jest.mock("~/components/ui/icon", () => ({
	Plus: () => null,
	Timer: () => null,
	ArrowRight: () => null,
	Clock3: () => null,
}));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/ui/screen", () => ({
	Screen: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("~/components/screen-header", () => ({
	ScreenHeader: ({
		title,
		right,
	}: {
		title: string;
		right?: React.ReactNode;
	}) => {
		const { Text, View } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<View>
				<Text>{title}</Text>
				{right}
			</View>
		);
	},
}));

test("empty learning times presents one add action instead of seven empty day cards", async () => {
	const screen = await render(<LearningTimesOverviewScreen />);
	expect(screen.getByText("Noch keine Lernzeiten")).toBeOnTheScreen();
	expect(screen.queryByText("Montag")).toBeNull();
	expect(
		screen.getAllByRole("button", { name: "Lernzeit hinzufügen" }),
	).toHaveLength(1);
	await fireEvent.press(
		screen.getByRole("button", { name: "Lernzeit hinzufügen" }),
	);
	expect(mockPush).toHaveBeenCalledWith("/learning-times/edit?day=1");
});
