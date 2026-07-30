import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
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

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		userAnalytics: {
			getExamAnalysis: "getExamAnalysis",
		},
	},
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
		ScreenScroll: ({
			children,
			testID,
		}: {
			children: ReactNode;
			testID?: string;
		}) => React.createElement(Native.View, { testID }, children),
	};
});

jest.mock("~/components/ui/themed-status-bar", () => ({
	ThemedStatusBar: () => null,
}));

jest.mock("~/components/ui/select-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		SelectSheet: ({
			visible,
			options,
			onSelect,
			formatOptionLabel,
		}: {
			visible: boolean;
			options: string[];
			onSelect: (option: string) => void;
			formatOptionLabel: (option: string) => string;
		}) =>
			visible
				? React.createElement(
						Native.View,
						null,
						options.map((option) =>
							React.createElement(
								Native.Pressable,
								{
									key: option,
									accessibilityRole: "radio",
									accessibilityLabel: formatOptionLabel(option),
									onPress: () => onSelect(option),
								},
								React.createElement(
									Native.Text,
									null,
									formatOptionLabel(option),
								),
							),
						),
					)
				: null,
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: {
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			text: "#151D30",
		},
	}),
}));

const emptyAnalysis = {
	hasData: false,
	preliminary: true,
	plans: [],
	selectedPlan: null,
	readiness: {
		secure: 0,
		developing: 0,
		unknown: 0,
	},
	abilities: [],
	improvements: [],
	primaryProblem: null,
	secondaryProblems: [],
	topics: [],
	recommendation: null,
	preparation: {
		remainingDays: 0,
		remainingSessions: 0,
		remainingMinutes: 0,
		nextSession: null,
	},
	updatedAt: null,
};

const examAnalysis = {
	hasData: true,
	preliminary: false,
	plans: [
		{
			id: "plan_1",
			subject: "Mathe",
			examTypeLabel: "Klausur",
			examDateKey: "2026-08-05",
			examDateLabel: "5. August 2026",
		},
		{
			id: "plan_2",
			subject: "Englisch",
			examTypeLabel: "Klausur",
			examDateKey: "2026-08-12",
			examDateLabel: "12. August 2026",
		},
	],
	selectedPlan: {
		id: "plan_1",
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-08-05",
		examDateLabel: "5. August 2026",
		daysRemaining: 8,
	},
	readiness: {
		secure: 1,
		developing: 1,
		unknown: 0,
	},
	abilities: [
		{
			statement: "Du erkennst lineare Zusammenhänge.",
			evidenceCount: 2,
			topicId: "steigung",
		},
	],
	improvements: [],
	primaryProblem: {
		id: "problem_1",
		diagnosisType: "applicationError",
		title: "Steigung",
		observation: "Steigung noch präziser erklären.",
		location: "Erkläre die Steigung.",
		explanation:
			"Die Steigung beschreibt die Änderung von y pro Änderung von x.",
		evidenceExcerpt: "Änderung von y.",
		evidenceCount: 1,
		evidenceLabel: "Einmal beobachtet",
		topicId: "steigung",
	},
	secondaryProblems: [],
	topics: [
		{
			id: "steigung",
			title: "Steigung erklären",
			learningGoal: "Du kannst die Steigung vollständig erklären.",
			priority: "high",
			status: "developing",
		},
		{
			id: "achsenschnitt",
			title: "Achsenschnittpunkte bestimmen",
			learningGoal: "Du kannst Achsenschnittpunkte sicher bestimmen.",
			priority: "medium",
			status: "secure",
		},
	],
	recommendation: {
		sessionId: "session_1",
		title: "Generalprobe",
		goal: "Steigung vollständig erklären",
		methods: ["Ein Beispiel ansehen", "Zwei Aufgaben lösen"],
		durationMinutes: 30,
		verification: "Du erklärst die Änderung von y pro Änderung von x.",
		reason: "Festige zuerst die Bedeutung der Steigung.",
	},
	preparation: {
		remainingDays: 8,
		remainingSessions: 1,
		remainingMinutes: 30,
		nextSession: {
			id: "session_1",
			dateKey: "2026-07-30",
			dateLabel: "30. Juli 2026",
			startTime: "16:00",
			durationMinutes: 30,
		},
	},
	updatedAt: Date.UTC(2026, 6, 28, 14),
};

describe("AnalyticsScreen", () => {
	beforeEach(() => {
		mockPush.mockReset();
		mockUseQuery.mockReset();
		mockUseQuery.mockReturnValue(emptyAnalysis);
		mockIsConvexAuthenticated = true;
		mockUser = { clerkId: "user_123" };
	});

	test("skips private exam analysis until both auth layers are ready", async () => {
		mockIsConvexAuthenticated = false;
		await render(<AnalyticsScreen />);
		expect(mockUseQuery).toHaveBeenCalledWith("getExamAnalysis", "skip");
	});

	test("guides a new learner to create the first plan", async () => {
		const screen = await render(<AnalyticsScreen />);
		fireEvent.press(
			screen.getByRole("button", { name: "Ersten Lernplan erstellen" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/learning-plans/new");
	});

	test("turns one selected exam into an evidence-backed next step", async () => {
		mockUseQuery.mockReturnValue(examAnalysis);
		const screen = await render(<AnalyticsScreen />);

		expect(
			screen.getByText("Du erkennst lineare Zusammenhänge."),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Steigung noch präziser erklären."),
		).toBeOnTheScreen();
		expect(screen.getByText("„Änderung von y.“")).toBeOnTheScreen();
		expect(screen.getByText("Dein nächster Lernschritt")).toBeOnTheScreen();
		expect(screen.queryByText("Antwortqualität")).not.toBeOnTheScreen();
		expect(screen.queryByText("Lernserie")).not.toBeOnTheScreen();

		fireEvent.press(screen.getByRole("button", { name: "30 Minuten starten" }));
		expect(mockPush).toHaveBeenCalledWith(
			"/learning-plans/plan_1/sessions/session_1",
		);
	});

	test("requests a newly selected exam without mixing its evidence", async () => {
		mockUseQuery.mockReturnValue(examAnalysis);
		const screen = await render(<AnalyticsScreen />);
		const switchButton = screen.getByRole("button", {
			name: "Prüfung wechseln. Ausgewählt: Mathe · Klausur · 5. August 2026",
		});

		expect(screen.getByText("Mathe · Klausur")).toBeOnTheScreen();
		expect(
			within(screen.getByTestId("analysis-scroll")).queryByRole("button", {
				name: /Prüfung wechseln/,
			}),
		).toBeNull();

		await fireEvent.press(switchButton);
		await fireEvent.press(
			screen.getByRole("radio", {
				name: "Englisch · Klausur · 12. August 2026",
			}),
		);

		expect(mockUseQuery).toHaveBeenLastCalledWith(
			"getExamAnalysis",
			expect.objectContaining({ learningPlanId: "plan_2" }),
		);
	});
});
