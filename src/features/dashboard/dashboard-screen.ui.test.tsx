import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import { DashboardScreen } from "./dashboard-screen";

const mockPush = jest.fn();
const mockNextStep = jest.fn();
const mockScroll = jest.fn();
const mockDayQuery = jest.fn();
const mockSelectionHaptic = jest.fn();
jest.mock("~/lib/safe-haptics", () => ({
	triggerSelectionHaptic: (...args: unknown[]) => mockSelectionHaptic(...args),
}));
jest.mock("react-native-reanimated", () => ({
	useReducedMotion: () => false,
}));
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
	useQuery: (query: string, args: unknown) => {
		if (query === "days") mockDayQuery(args);
		return query === "plans"
			? mockHasPlan
				? [{ id: "plan", subject: "Italienisch" }]
				: []
			: { "2026-09-29": [mockEntry], "2026-09-30": [] };
	},
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
jest.mock("react-native/Libraries/Lists/FlatList", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const RN = jest.requireActual<typeof import("react-native")>("react-native");
	return {
		__esModule: true,
		default: React.forwardRef(
			(
				props: import("react-native").ViewProps & {
					data: string[];
					extraData: { selectedKey: string };
					renderItem: (info: { item: string }) => import("react").ReactNode;
				},
				ref,
			) => {
				React.useImperativeHandle(ref, () => ({
					scrollToOffset: (options: unknown) =>
						mockScroll(props.testID, options),
				}));
				const index = props.data.indexOf(props.extraData.selectedKey);
				return React.createElement(
					RN.View,
					props,
					props.data
						.slice(Math.max(0, index - 1), index + 2)
						.map((item) =>
							React.createElement(
								React.Fragment,
								{ key: item },
								props.renderItem({ item }),
							),
						),
				);
			},
		),
	};
});
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

async function renderWithPagers() {
	const screen = await render(<DashboardScreen />);
	for (const testID of ["calendar-day-pager", "calendar-week-pager"]) {
		await fireEvent(screen.getByTestId(`${testID}-viewport`), "layout", {
			nativeEvent: { layout: { width: 400 } },
		});
		const pager = screen.getByTestId(testID);
		await fireEvent(
			pager,
			"scroll",
			pageEvent(pager.props.data, pager.props.extraData.selectedKey),
		);
	}
	return screen;
}

function pageEvent(keys: string[], key: string) {
	return { nativeEvent: { contentOffset: { x: keys.indexOf(key) * 400 } } };
}

test("previewing and reversing a week changes visuals without query churn or haptics", async () => {
	const screen = await renderWithPagers();
	const originalQuery = mockDayQuery.mock.calls.at(-1)?.[0];
	const pager = screen.getByTestId("calendar-week-pager");
	await fireEvent(pager, "scrollBeginDrag");
	await fireEvent(pager, "scroll", pageEvent(pager.props.data, "2026-11-02"));
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-11-03");
	expect(mockDayQuery.mock.calls.at(-1)?.[0]).toEqual(originalQuery);
	expect(mockSelectionHaptic).not.toHaveBeenCalled();
	// The synchronized day strip finishing its command must not commit the week preview.
	const day = screen.getByTestId("calendar-day-pager");
	await fireEvent(
		day,
		"momentumScrollEnd",
		pageEvent(day.props.data, "2026-11-03"),
	);
	expect(mockDayQuery.mock.calls.at(-1)?.[0]).toEqual(originalQuery);
	await fireEvent(
		screen.getByTestId("calendar-week-pager"),
		"momentumScrollEnd",
		pageEvent(pager.props.data, "2026-09-28"),
	);
	expect(mockDayQuery.mock.calls.at(-1)?.[0]).toEqual(originalQuery);
	expect(mockSelectionHaptic).not.toHaveBeenCalled();
});

test("a settled week updates its query and haptic once, retaining the selected weekday", async () => {
	const screen = await renderWithPagers();
	const originalQuery = mockDayQuery.mock.calls.at(-1)?.[0];
	const pager = screen.getByTestId("calendar-week-pager");
	await fireEvent(pager, "scrollBeginDrag");
	await fireEvent(pager, "scroll", pageEvent(pager.props.data, "2026-11-02"));
	const settled = pageEvent(pager.props.data, "2026-11-02");
	await fireEvent(
		screen.getByTestId("calendar-week-pager"),
		"momentumScrollEnd",
		settled,
	);
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-11-03");
	expect(mockDayQuery.mock.calls.at(-1)?.[0]).not.toEqual(originalQuery);
	expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
	await fireEvent(
		screen.getByTestId("calendar-week-pager"),
		"momentumScrollEnd",
		settled,
	);
	expect(mockSelectionHaptic).toHaveBeenCalledTimes(1);
});

test("hero opens its session and agenda opens its plan, both returning to Today", async () => {
	const screen = await renderWithPagers();
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
	const screen = await renderWithPagers();
	const pager = screen.getByTestId("calendar-day-pager");
	await fireEvent(pager, "scroll", pageEvent(pager.props.data, "2026-09-30"));
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-09-30");
	expect(mockNextStep).toHaveBeenLastCalledWith("2026-09-29", true);
	await fireEvent.press(screen.getByText("Hero"));
	expect(mockPush).toHaveBeenLastCalledWith(
		"/learning-plans/plan/sessions/session?returnTo=%2Fhome",
	);
});

test("native week paging without a touch drag synchronizes the day pager", async () => {
	const screen = await renderWithPagers();
	const pager = screen.getByTestId("calendar-week-pager");
	await fireEvent(pager, "scroll", pageEvent(pager.props.data, "2026-10-05"));
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-10-06");
	expect(mockScroll).toHaveBeenCalledWith(
		"calendar-day-pager",
		expect.objectContaining({ animated: true }),
	);
	expect(
		mockScroll.mock.calls.some(([id]) => id === "calendar-week-pager"),
	).toBe(false);
});

test.each([
	["calendar-day-pager", "2026-09-30", "2026-09-29"],
	["calendar-week-pager", "2026-10-05", "2026-09-28"],
])("%s retains a forward/reverse selection in one batch", async (testID, next, original) => {
	const screen = await renderWithPagers();
	const handlers = screen.getByTestId(testID).props;
	await act(async () => {
		handlers.onScrollBeginDrag();
		handlers.onScroll(pageEvent(handlers.data, next));
		handlers.onScroll(pageEvent(handlers.data, original));
	});
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-09-29");
	expect(
		screen.getByTestId("calendar-week-pager").props.extraData.selectedKey,
	).toBe("2026-09-28");
	expect(mockScroll).not.toHaveBeenCalled();
});

test("a settled reversal in the same batch wins over the last scroll midpoint", async () => {
	const screen = await renderWithPagers();
	const handlers = screen.getByTestId("calendar-day-pager").props;
	await act(async () => {
		handlers.onScrollBeginDrag();
		handlers.onScroll(pageEvent(handlers.data, "2026-09-30"));
		handlers.onMomentumScrollEnd(pageEvent(handlers.data, "2026-09-29"));
	});
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-09-29");
	expect(mockScroll).not.toHaveBeenCalled();
});

test("a week move uses the weekday selected earlier in the same batch", async () => {
	const screen = await renderWithPagers();
	const day = screen.getByTestId("calendar-day-pager").props;
	const week = screen.getByTestId("calendar-week-pager").props;
	await act(async () => {
		day.onScroll(pageEvent(day.data, "2026-09-30"));
		week.onScroll(pageEvent(week.data, "2026-10-05"));
	});
	expect(
		screen.getByTestId("calendar-day-pager").props.extraData.selectedKey,
	).toBe("2026-10-07");
});

test("new learner fallback preserves the existing main creation route and return destination", async () => {
	mockHasPlan = false;
	const screen = await render(<DashboardScreen />);
	await fireEvent.press(screen.getByText("Hero"));
	expect(mockPush).toHaveBeenLastCalledWith(
		"/entry/new?type=exam&returnTo=%2Fhome",
	);
});
