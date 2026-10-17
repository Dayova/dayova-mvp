import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { DashboardScreen } from "./dashboard-screen";

const mockPush = jest.fn();
const mockNextStep = jest.fn();
const mockEntry = {
	id: "entry",
	title: "Wissenscheck",
	kind: "Lernen",
	relatedLearningPlanId: "plan",
	relatedLearningPlanSessionId: "session",
};
let mockHasPlan = true;
jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
	useLocalSearchParams: () => ({}),
}));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0 }),
}));
jest.mock("react-native-screens/experimental", () => ({
	SafeAreaView: require("react-native").View,
}));
jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));
jest.mock("~/components/create-entry-button", () => ({
	CreateEntryButton: () => {
		const React = jest.requireActual<typeof import("react")>("react");
		return React.createElement(require("react-native").View, {
			testID: "create-entry-action",
		});
	},
}));
jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: { name: "Philipp" } }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { background: "#fff" } }),
}));
jest.mock("~/lib/day-key", () => ({
	...jest.requireActual<object>("~/lib/day-key"),
	useCurrentLocalDay: () => new Date(2026, 8, 29),
}));
jest.mock("#convex/_generated/api", () => ({
	api: {
		dayEntries: { listByDayKeys: "days" },
		learningPlans: { listOverview: "plans" },
	},
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: (query: string) =>
		query === "plans"
			? mockHasPlan
				? [{ id: "plan", subject: "Italienisch" }]
				: []
			: { "2026-09-29": [mockEntry], "2026-09-30": [] },
}));
jest.mock("./use-next-learning-step", () => ({
	useNextLearningStep: (...args: unknown[]) => {
		mockNextStep(...args);
		return {
			item: mockHasPlan
				? { entry: mockEntry, dayKey: "2026-09-29", kind: "learningSession" }
				: undefined,
			isLoading: false,
		};
	},
}));
jest.mock("./today-learning-card", () => ({
	TodayLearningCard: ({
		item,
		onOpenItem,
		onOpenFallback,
	}: {
		item?: unknown;
		onOpenItem: (item: unknown) => void;
		onOpenFallback: () => void;
	}) => {
		const ActualReact = jest.requireActual<typeof import("react")>("react");
		const { Button } = require("react-native");
		return ActualReact.createElement(Button, {
			title: "Hero",
			onPress: () => (item ? onOpenItem(item) : onOpenFallback()),
		});
	},
}));
jest.mock("./dashboard-calendar-header", () => ({
	DashboardCalendarHeader: ({
		createAction,
	}: {
		createAction?: import("react").ReactNode;
	}) => createAction ?? null,
}));
jest.mock("./week-calendar", () => ({
	CalendarWeekdays: () => null,
	WeekCalendar: () => null,
}));
jest.mock("./calendar-pager", () => ({
	CalendarPager: ({
		testID,
		selectedKey,
		onSelect,
		renderPage,
	}: {
		testID: string;
		selectedKey: string;
		onSelect: (key: string) => void;
		renderPage: (key: string) => import("react").ReactNode;
	}) => {
		const ActualReact = jest.requireActual<typeof import("react")>("react");
		const { View, Button, Text } = require("react-native");
		return ActualReact.createElement(
			View,
			null,
			ActualReact.createElement(
				Text,
				{ testID: `${testID}-selected` },
				selectedKey,
			),
			testID === "calendar-day-pager"
				? ActualReact.createElement(Button, {
						title: "Morgen auswählen",
						onPress: () => onSelect("2026-09-30"),
					})
				: null,
			renderPage(selectedKey),
		);
	},
}));
jest.mock("./compact-day-agenda", () => ({
	CompactDayAgenda: ({
		items,
		onOpenItem,
	}: {
		items: unknown[];
		onOpenItem: (item: unknown) => void;
	}) => {
		const ActualReact = jest.requireActual<typeof import("react")>("react");
		const { Button } = require("react-native");
		return items.length
			? ActualReact.createElement(Button, {
					title: "Agenda",
					onPress: () => onOpenItem(items[0]),
				})
			: null;
	},
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockHasPlan = true;
});

test("renders the only plus action inside the calendar rather than the greeting", async () => {
	const screen = await render(<DashboardScreen />);
	expect(screen.getAllByTestId("create-entry-action")).toHaveLength(1);
	expect(
		within(screen.getByTestId("dashboard-calendar")).getByTestId(
			"create-entry-action",
		),
	).toBeTruthy();
});

test("hero opens its session and agenda opens its plan, both returning to Today", async () => {
	const screen = await render(<DashboardScreen />);
	await fireEvent.press(screen.getByText("Hero"));
	expect(mockPush).toHaveBeenLastCalledWith(
		"/learning-plans/plan/sessions/session?returnTo=%2Fhome",
	);
	await fireEvent.press(screen.getByText("Agenda"));
	expect(mockPush).toHaveBeenLastCalledWith(
		"/learning-plans/plan?returnTo=%2Fhome",
	);
});

test("calendar day changes do not move the hero search away from today", async () => {
	const screen = await render(<DashboardScreen />);
	await fireEvent.press(screen.getByText("Morgen auswählen"));
	expect(screen.getByTestId("calendar-day-pager-selected")).toHaveTextContent(
		"2026-09-30",
	);
	expect(mockNextStep).toHaveBeenLastCalledWith("2026-09-29", true);
	await fireEvent.press(screen.getByText("Hero"));
	expect(mockPush).toHaveBeenLastCalledWith(
		"/learning-plans/plan/sessions/session?returnTo=%2Fhome",
	);
});

test("new learner fallback preserves the existing main creation route and return destination", async () => {
	mockHasPlan = false;
	const screen = await render(<DashboardScreen />);
	await fireEvent.press(screen.getByText("Hero"));
	expect(mockPush).toHaveBeenLastCalledWith(
		"/entry/new?type=exam&returnTo=%2Fhome",
	);
});
