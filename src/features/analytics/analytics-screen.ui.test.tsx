import type { ReactNode } from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { AnalyticsScreen } from "./analytics-screen";

const mockPush = jest.fn();
const mockUseQuery = jest.fn();
let mockIsConvexAuthenticated = true;
let mockUser: { clerkId: string } | null = { clerkId: "user_123" };

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mockIsConvexAuthenticated }),
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock("#convex/_generated/api", () => ({
	api: { userAnalytics: { getOverview: "getOverview" } },
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: mockUser }),
}));

jest.mock("~/components/notification-button", () => ({
	NotificationButton: () => null,
}));

jest.mock("~/components/ui/animated-flower-loader", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		AnimatedFlowerLoader: () =>
			React.createElement("AnimatedFlowerLoader", null),
	};
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy(
		{ __esModule: true },
		{
			get: (target, property) =>
				property in target ? target[property as keyof typeof target] : Icon,
		},
	);
});

jest.mock("~/components/ui/screen", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Screen: ({ children }: { children: ReactNode }) =>
			React.createElement(Native.View, null, children),
		ScreenScroll: ({ children }: { children: ReactNode }) =>
			React.createElement(Native.View, null, children),
	};
});

jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			border: "#DCE6EE",
			info: "#C9A100",
			light2: "#F3F6FA",
			primaryStrong: "#00A0E6",
			success: "#34C759",
			text: "#1A1A1A",
			wrong: "#FF9500",
		},
	}),
}));

const emptyOverview = {
	hasData: false,
	historyLimited: false,
	overall: {
		acceptedPlans: 0,
		finishedPlans: 0,
		completedSessions: 0,
		totalSessions: 0,
		progressPercent: 0,
	},
	period: {
		completedSessions: 0,
		activeStudyMinutes: 0,
		recoveredSessions: 0,
	},
	currentStreakDays: 0,
	activity: [],
	plans: [],
	nextSession: null,
	knowledge: {
		answeredItems: 0,
		correct: 0,
		partiallyCorrect: 0,
		notCorrect: 0,
		scorePercent: null,
		strengths: [],
		gaps: [],
		recommendation: null,
	},
};

const populatedOverview = {
	...emptyOverview,
	hasData: true,
	overall: {
		acceptedPlans: 1,
		finishedPlans: 0,
		completedSessions: 2,
		totalSessions: 3,
		progressPercent: 67,
	},
	period: {
		completedSessions: 2,
		activeStudyMinutes: 30,
		recoveredSessions: 1,
	},
	currentStreakDays: 2,
	activity: [
		{
			dayKey: "2026-07-28",
			completedSessions: 1,
			activeStudyMinutes: 10,
		},
	],
	plans: [
		{
			id: "plan_1",
			subject: "Mathe",
			examTypeLabel: "Klausur",
			examDateKey: "2026-08-05",
			examDateLabel: "5. August 2026",
			progressPercent: 67,
			completedSessions: 2,
			totalSessions: 3,
		},
	],
	nextSession: {
		id: "session_1",
		learningPlanId: "plan_1",
		subject: "Mathe",
		title: "Generalprobe",
		dateKey: "2026-07-30",
	},
	knowledge: {
		answeredItems: 1,
		correct: 0,
		partiallyCorrect: 1,
		notCorrect: 0,
		scorePercent: 50,
		strengths: ["Du erkennst lineare Zusammenhänge."],
		gaps: ["Steigung noch präziser erklären."],
		recommendation: "Übe eine weitere Steigungsaufgabe.",
	},
};

describe("AnalyticsScreen", () => {
	beforeEach(() => {
		mockPush.mockReset();
		mockUseQuery.mockReset();
		mockUseQuery.mockReturnValue(emptyOverview);
		mockIsConvexAuthenticated = true;
		mockUser = { clerkId: "user_123" };
	});

	test("skips private analytics until both auth layers are ready", async () => {
		mockIsConvexAuthenticated = false;
		await render(<AnalyticsScreen />);
		expect(mockUseQuery).toHaveBeenCalledWith("getOverview", "skip");
	});

	test("guides a new learner to create the first plan", async () => {
		const screen = await render(<AnalyticsScreen />);
		fireEvent.press(
			screen.getByRole("button", { name: "Ersten Lernplan erstellen" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/learning-plans/new");
	});

	test("shows real progress and refreshes period-sensitive data", async () => {
		mockUseQuery.mockReturnValue(populatedOverview);
		const screen = await render(<AnalyticsScreen />);

		expect(screen.getAllByText("67%")).toHaveLength(2);
		expect(screen.getByText("30 min")).toBeOnTheScreen();
		expect(screen.getByText("Antwortqualität")).toBeOnTheScreen();
		expect(
			screen.getByText(
				"Du hast einen verschobenen Lernblock erfolgreich nachgeholt.",
			),
		).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("tab", { name: "30 Tage" }));
		expect(mockUseQuery).toHaveBeenLastCalledWith(
			"getOverview",
			expect.objectContaining({ period: "month" }),
		);
	});

	test("opens the next learning session from the primary action", async () => {
		mockUseQuery.mockReturnValue(populatedOverview);
		const screen = await render(<AnalyticsScreen />);

		fireEvent.press(screen.getByRole("button", { name: "Mathe weiterlernen" }));
		expect(mockPush).toHaveBeenCalledWith(
			"/learning-plans/plan_1/sessions/session_1",
		);
	});
});
