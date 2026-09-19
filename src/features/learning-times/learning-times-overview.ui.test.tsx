import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import LearningTimesOverviewScreen from "~/app/learning-times";

const mockRemove = jest.fn<(args: { id: string }) => Promise<void>>();

beforeEach(() => {
	mockRemove.mockReset();
	mockRemove.mockResolvedValue(undefined);
});

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useQuery: () => [
		{
			id: "monday-id",
			dayOfWeek: 1,
			startTime: "17:00",
			endTime: "17:30",
			preferenceStatus: "confirmed",
		},
		{
			id: "friday-id",
			dayOfWeek: 5,
			startTime: "16:00",
			endTime: "17:00",
			preferenceStatus: "confirmed",
		},
	],
	useMutation: () => mockRemove,
}));

jest.mock("expo-router", () => ({
	useLocalSearchParams: () => ({}),
	useRouter: () => ({
		canGoBack: () => false,
		push: jest.fn(),
		replace: jest.fn(),
	}),
}));

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { id: "user-id" } }),
}));

jest.mock("~/components/ui/add-icon", () => ({ AddIcon: () => null }));
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
jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheet: ({
		visible,
		title,
		description,
		onConfirm,
	}: {
		visible: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
	}) => {
		const { Pressable, Text, View } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return visible ? (
			<View>
				<Text>{title}</Text>
				<Text>{description}</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Löschen bestätigen"
					onPress={onConfirm}
				/>
			</View>
		) : null;
	},
}));
jest.mock("~/features/learning-times/weekly-learning-times", () => ({
	WeeklyLearningTimes: ({
		entries,
		onRemove,
	}: {
		entries: Array<{
			id: string;
			dayOfWeek: number;
			startTime: string;
			endTime: string;
		}>;
		onRemove: (entry: {
			id: string;
			dayOfWeek: number;
			startTime: string;
			endTime: string;
		}) => void;
	}) => {
		const { Pressable } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Freitag löschen"
				onPress={() => onRemove(entries[1])}
			/>
		);
	},
}));

test("requires confirmation and deletes only the selected learning time", async () => {
	const screen = await render(<LearningTimesOverviewScreen />);

	await fireEvent.press(
		screen.getByRole("button", { name: "Freitag löschen" }),
	);
	expect(mockRemove).not.toHaveBeenCalled();
	expect(screen.getByText("Lernzeit löschen?")).toBeTruthy();
	expect(
		screen.getByText("Möchtest du die Lernzeit 16:00–17:00 wirklich löschen?"),
	).toBeTruthy();

	await fireEvent.press(
		screen.getByRole("button", { name: "Löschen bestätigen" }),
	);
	expect(mockRemove).toHaveBeenCalledTimes(1);
	expect(mockRemove).toHaveBeenCalledWith({ id: "friday-id" });
});
