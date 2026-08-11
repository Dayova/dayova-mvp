import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { Id } from "#convex/_generated/dataModel";
import {
	AnalyticsDetailScreen,
	AnalyticsHistoryScreen,
	AnalyticsScreen,
} from "./analytics-screen";

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
			getOverview: "getOverview",
			getTopicQuestionEvidence: "getTopicQuestionEvidence",
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
			border: "#DCE6EE",
			primaryStrong: "#00A0E6",
			secondaryText: "#697586",
			success: "#34C759",
			text: "#151D30",
			theorie: "#5856D6",
			wrong: "#FF9500",
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
		uncertain: 0,
		unknown: 0,
	},
	abilities: [],
	improvements: [],
	latestKnowledgeChange: null,
	reviewedNotVerified: false,
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
		developing: 0,
		uncertain: 1,
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
	latestKnowledgeChange:
		"Seit deinem letzten Check: Steigung gelingt dir jetzt sicherer.",
	reviewedNotVerified: false,
	primaryProblem: {
		id: "problem_1",
		diagnosisType: "applicationError",
		title: "Steigung",
		observation: "Steigung noch präziser erklären.",
		location: "Erkläre die Steigung.",
		explanation:
			"Die Steigung beschreibt die Änderung von y pro Änderung von x.",
		evidenceExcerpt: "Änderung von y.",
		correctAnswer: "Änderung von y pro Änderung von x.",
		priorityReason: "Hohe Prüfungsrelevanz · einmal beobachtet · noch 8 Tage",
		diagnosisConfidence:
			"Erste Beobachtung – Dayova prüft dieses Muster weiter.",
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
			status: "uncertain",
			summary: "Steigung noch präziser erklären.",
			evidenceCount: 2,
			answeredQuestionCount: 2,
			dimensions: [
				{
					kind: "understanding",
					required: true,
					status: "secure",
					evidenceCount: 2,
				},
				{
					kind: "problemSolving",
					required: true,
					status: "uncertain",
					evidenceCount: 1,
				},
				{
					kind: "independent",
					required: true,
					status: "unknown",
					evidenceCount: 0,
				},
			],
			strengths: [
				{
					statement: "Du erkennst lineare Zusammenhänge.",
					evidenceCount: 2,
				},
			],
			weaknesses: [
				{
					statement: "Steigung noch präziser erklären.",
					evidenceCount: 1,
				},
			],
			controlCheckReason: null,
		},
		{
			id: "achsenschnitt",
			title: "Achsenschnittpunkte bestimmen",
			learningGoal: "Du kannst Achsenschnittpunkte sicher bestimmen.",
			priority: "medium",
			status: "secure",
			summary: "Alle erforderlichen Wissensbelege vorhanden.",
			evidenceCount: 3,
			answeredQuestionCount: 3,
			dimensions: [
				{
					kind: "understanding",
					required: true,
					status: "secure",
					evidenceCount: 3,
				},
				{
					kind: "problemSolving",
					required: true,
					status: "secure",
					evidenceCount: 2,
				},
				{
					kind: "independent",
					required: true,
					status: "secure",
					evidenceCount: 2,
				},
			],
			strengths: [
				{
					statement: "Du bestimmst Achsenschnittpunkte sicher.",
					evidenceCount: 3,
				},
			],
			weaknesses: [],
			controlCheckReason: null,
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

const topicQuestionEvidence = {
	topic: {
		id: "steigung",
		title: "Steigung erklären",
		learningGoal: "Du kannst die Steigung vollständig erklären.",
	},
	questions: [
		{
			itemId: "item_1",
			sessionId: "session_done",
			sessionTitle: "Gleichungen üben",
			phase: "practice",
			prompt: "Erkläre die Steigung.",
			answer: "Änderung von y.",
			review:
				"Du nennst die Änderung von y, aber die Änderung von x fehlt noch.",
			idealAnswer: "Änderung von y pro Änderung von x.",
			rating: "partiallyCorrect",
			answeredAt: Date.UTC(2026, 6, 28, 13, 30),
		},
		{
			itemId: "item_2",
			sessionId: "session_done_2",
			sessionTitle: "Transfer üben",
			phase: "rehearsal",
			prompt: "Berechne die Steigung zwischen zwei Punkten.",
			answer: "Die Steigung ist 2.",
			review:
				"Noch nicht korrekt. Schau dir die perfekte Antwort an und achte auf den vollständigen Lösungsweg. Der eingesetzte Rechenweg passt noch nicht zu den gegebenen Punkten.",
			idealAnswer: "m = 2",
			rating: "notCorrect",
			answeredAt: Date.UTC(2026, 6, 29, 13, 30),
		},
	],
	historyLimited: false,
};

const historyOverview = {
	hasData: true,
	historyLimited: false,
	overall: {
		acceptedPlans: 3,
		finishedPlans: 1,
		completedSessions: 8,
		totalSessions: 12,
		progressPercent: 67,
	},
	period: {
		completedSessions: 8,
		activeStudyMinutes: 160,
		recoveredSessions: 1,
	},
	currentStreakDays: 2,
	activity: [],
	plans: [],
	nextSession: null,
	knowledge: {
		answeredItems: 14,
		correct: 8,
		partiallyCorrect: 3,
		notCorrect: 3,
		scorePercent: 68,
		strengths: ["Du kannst lineare Funktionen sicher erklären."],
		gaps: ["Vorzeichen beim Umformen bleiben noch fehleranfällig."],
		recommendation: null,
	},
};

describe("AnalyticsScreen", () => {
	beforeEach(() => {
		mockPush.mockReset();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation((query) =>
			query === "getTopicQuestionEvidence" ? undefined : emptyAnalysis,
		);
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
		await fireEvent.press(
			screen.getByRole("button", { name: "Ersten Lernplan erstellen" }),
		);
		expect(mockPush).toHaveBeenCalledWith("/learning-plans/new");
	});

	test("shows every topic and opens its exact knowledge evidence", async () => {
		mockUseQuery.mockReturnValue(examAnalysis);
		const screen = await render(<AnalyticsScreen />);

		expect(screen.queryByText("Dein Wissensstand")).not.toBeOnTheScreen();
		expect(screen.queryByText("1/2")).not.toBeOnTheScreen();
		expect(screen.queryByText("1 von 2 sicher belegt")).not.toBeOnTheScreen();
		expect(screen.queryByText("1 unsicher")).not.toBeOnTheScreen();
		expect(screen.getByText("Deine Prüfungsthemen")).toBeOnTheScreen();
		expect(screen.getByText("Steigung erklären")).toBeOnTheScreen();
		expect(screen.getByText("Achsenschnittpunkte bestimmen")).toBeOnTheScreen();
		expect(screen.getByText("2 ausgewertete Antworten")).toBeOnTheScreen();
		expect(screen.getByText("3 ausgewertete Antworten")).toBeOnTheScreen();
		expect(screen.queryByText("„Änderung von y.“")).not.toBeOnTheScreen();
		expect(
			screen.queryByText("Schon belegt: Du erkennst lineare Zusammenhänge."),
		).not.toBeOnTheScreen();
		expect(
			screen.queryByText("Du kannst 1 von 2 Prüfungsthemen sicher anwenden."),
		).not.toBeOnTheScreen();
		expect(
			screen.queryByText(
				"Seit deinem letzten Check: Steigung gelingt dir jetzt sicherer.",
			),
		).not.toBeOnTheScreen();
		expect(screen.getByText("Dein nächster Schritt")).toBeOnTheScreen();
		expect(screen.queryByText("Größte Lernhürde")).not.toBeOnTheScreen();
		expect(screen.queryByText("Dein Prüfungsstoff")).not.toBeOnTheScreen();
		expect(
			screen.queryByText("Deine Entwicklung über mehrere Prüfungen"),
		).not.toBeOnTheScreen();

		await fireEvent.press(
			screen.getByRole("button", {
				name: "Nächster Schritt: Steigung vollständig erklären",
			}),
		);
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/analyse/naechster-schritt",
			params: { planId: "plan_1" },
		});

		await fireEvent.press(
			screen.getByRole("button", {
				name: "Steigung erklären. Unsicher. 2 ausgewertete Antworten.",
			}),
		);
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/analyse/wissensstand",
			params: { planId: "plan_1", topicId: "steigung" },
		});
	});

	test("does not show an aggregate knowledge card with existing evidence", async () => {
		mockUseQuery.mockReturnValue({
			...examAnalysis,
			readiness: {
				secure: 0,
				developing: 5,
				uncertain: 0,
				unknown: 0,
			},
		});
		const screen = await render(<AnalyticsScreen />);

		expect(screen.queryByText("Dein Wissensstand")).not.toBeOnTheScreen();
		expect(screen.queryByText("0/5")).not.toBeOnTheScreen();
		expect(screen.queryByText("0 von 5 sicher belegt")).not.toBeOnTheScreen();
		expect(screen.queryByText("5 im Aufbau")).not.toBeOnTheScreen();
		expect(screen.getByText("Deine Prüfungsthemen")).toBeOnTheScreen();
		expect(
			screen.queryByText(
				"Du arbeitest an allen 5 Prüfungsthemen, aber noch keines ist sicher belegt.",
			),
		).not.toBeOnTheScreen();
	});

	test("does not show an aggregate knowledge card without evidence", async () => {
		mockUseQuery.mockReturnValue({
			...examAnalysis,
			readiness: {
				secure: 0,
				developing: 0,
				uncertain: 0,
				unknown: 2,
			},
			topics: examAnalysis.topics.map((topic) => ({
				...topic,
				status: "unknown",
				summary: "Noch keine überprüften Antworten.",
				evidenceCount: 0,
				dimensions: topic.dimensions.map((dimension) => ({
					...dimension,
					status: "unknown",
					evidenceCount: 0,
				})),
				strengths: [],
				weaknesses: [],
				controlCheckReason: null,
			})),
		});
		const screen = await render(<AnalyticsScreen />);

		expect(screen.queryByText("Dein Wissensstand")).not.toBeOnTheScreen();
		expect(screen.queryByText("–")).not.toBeOnTheScreen();
		expect(
			screen.queryByText("Noch keine Wissensbelege"),
		).not.toBeOnTheScreen();
		expect(screen.queryByText("0/2")).not.toBeOnTheScreen();
		expect(screen.getByText("Deine Prüfungsthemen")).toBeOnTheScreen();
	});

	test("reveals evidence and starts the recommendation from focused pages", async () => {
		mockUseQuery.mockImplementation((query) =>
			query === "getTopicQuestionEvidence"
				? topicQuestionEvidence
				: examAnalysis,
		);
		const planId = "plan_1" as Id<"learningPlans">;
		const knowledgeScreen = await render(
			<AnalyticsDetailScreen
				planId={planId}
				section="knowledge"
				topicId="steigung"
			/>,
		);

		expect(knowledgeScreen.getByText("Dein Wissensprofil")).toBeOnTheScreen();
		expect(knowledgeScreen.getByText("Verstehen")).toBeOnTheScreen();
		expect(knowledgeScreen.getByText("Probleme lösen")).toBeOnTheScreen();
		expect(knowledgeScreen.getByText("Selbstständig lösen")).toBeOnTheScreen();
		expect(
			knowledgeScreen.queryByText("Warum du hier unsicher bist"),
		).not.toBeOnTheScreen();
		expect(
			knowledgeScreen.queryByText("Das kannst du schon"),
		).not.toBeOnTheScreen();
		expect(
			knowledgeScreen.getByText("Steigung noch präziser erklären."),
		).toBeOnTheScreen();
		expect(knowledgeScreen.getByText("Deine Antworten")).toBeOnTheScreen();
		expect(knowledgeScreen.getByText("1 von 2")).toBeOnTheScreen();
		expect(
			knowledgeScreen.getByText("Erkläre die Steigung."),
		).toBeOnTheScreen();
		expect(knowledgeScreen.getByText("Änderung von y.")).toBeOnTheScreen();
		expect(
			knowledgeScreen.getByText(
				"Du nennst die Änderung von y, aber die Änderung von x fehlt noch.",
			),
		).toBeOnTheScreen();
		expect(
			knowledgeScreen.queryByText("Änderung von y pro Änderung von x."),
		).not.toBeOnTheScreen();
		expect(knowledgeScreen.queryByText("m = 2")).not.toBeOnTheScreen();
		expect(
			knowledgeScreen.queryByText(/Schau dir die perfekte Antwort an/),
		).not.toBeOnTheScreen();
		expect(
			knowledgeScreen.getByText(
				"Der eingesetzte Rechenweg passt noch nicht zu den gegebenen Punkten.",
			),
		).toBeOnTheScreen();
		await fireEvent(
			knowledgeScreen.getByTestId("topic-answer-pager"),
			"momentumScrollEnd",
			{ nativeEvent: { contentOffset: { x: 10_000 } } },
		);
		expect(knowledgeScreen.getByText("2 von 2")).toBeOnTheScreen();
		expect(
			knowledgeScreen.queryByText("Alle Prüfungsthemen"),
		).not.toBeOnTheScreen();
		expect(
			knowledgeScreen.queryByText("Achsenschnittpunkte bestimmen"),
		).not.toBeOnTheScreen();

		await knowledgeScreen.unmount();
		const problemScreen = await render(
			<AnalyticsDetailScreen planId={planId} section="problem" />,
		);

		expect(problemScreen.getByText("„Änderung von y.“")).toBeOnTheScreen();
		expect(
			problemScreen.getByText(
				"Die Steigung beschreibt die Änderung von y pro Änderung von x.",
			),
		).toBeOnTheScreen();

		await problemScreen.unmount();
		const nextStepScreen = await render(
			<AnalyticsDetailScreen planId={planId} section="nextStep" />,
		);
		await fireEvent.press(
			nextStepScreen.getByRole("button", { name: "30 Minuten starten" }),
		);
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

	test("shows long-term knowledge evidence without turning it into a score", async () => {
		mockUseQuery.mockReturnValue(historyOverview);
		const screen = await render(<AnalyticsHistoryScreen />);

		expect(screen.getByText("Bisher belegte Stärken")).toBeOnTheScreen();
		expect(
			screen.getByText("Du kannst lineare Funktionen sicher erklären."),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Vorzeichen beim Umformen bleiben noch fehleranfällig."),
		).toBeOnTheScreen();
		expect(screen.queryByText("68 %")).not.toBeOnTheScreen();
	});
});
