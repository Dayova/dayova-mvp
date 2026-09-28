import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { toDashboardAgendaItem } from "./dashboard-agenda";
import { getDashboardNextStepFallbackAction } from "./dashboard-empty-state";
import { TodayLearningCard } from "./today-learning-card";

let mockStack = false;
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return {
		ArrowUpRight: icon,
		BookOpen: icon,
		CalendarDays: icon,
		Clock3: icon,
		Play: icon,
		Calculator: (props: Record<string, unknown>) =>
			React.createElement("Icon", { ...props, name: "calculator" }),
		Pencil: (props: Record<string, unknown>) =>
			React.createElement("Icon", { ...props, name: "pencil" }),
	};
});
jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: mockStack }),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { border: "#DCE6EE", surface: "#FFFFFF", secondaryText: "#697586" },
	}),
}));

const item = toDashboardAgendaItem("2026-09-28", {
	id: "session-1" as Id<"learningPlanSessions">,
	relatedLearningPlanSessionId: "session-1" as Id<"learningPlanSessions">,
	title: "Mathematik Gleichungen mit Klammern lösen",
	durationMinutes: 17,
	executionStatus: "notStarted",
});
const plan = {
	subject: "Mathematik",
	examTypeLabel: "Klassenarbeit",
	examDateLabel: "5. Oktober 2026",
};
const props = {
	item,
	plan,
	isLoading: false,
	fallbackAction: getDashboardNextStepFallbackAction({
		hasLearningPlans: false,
	}),
	onOpenItem: jest.fn(),
	onOpenFallback: jest.fn(),
};

describe("TodayLearningCard", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockStack = false;
	});
	test("shows context, topic and duration with one learning action", async () => {
		const screen = await render(<TodayLearningCard {...props} />);
		expect(screen.getByText("Mathematik")).toBeTruthy();
		expect(screen.queryByText(/Klassenarbeit/)).toBeNull();
		expect(screen.getByText("Gleichungen mit Klammern lösen")).toBeTruthy();
		expect(screen.getByText("17 min")).toBeTruthy();
		expect(screen.getByTestId("today-subject-icon").props.name).toBe(
			"calculator",
		);
		expect(screen.getByText("Mathematik").props.className).toContain(
			"font-semibold",
		);
		expect(
			screen.getByText("Gleichungen mit Klammern lösen").props.className,
		).toContain("text-body-1");
		expect(
			screen.getByTestId("today-learning-play", { includeHiddenElements: true })
				.props.strokeWidth,
		).toBe(2.5);
		expect(screen.queryByText(/ca\./)).toBeNull();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		await fireEvent.press(
			screen.getByRole("button", { name: /^Jetzt lernen/ }),
		);
		expect(props.onOpenItem).toHaveBeenCalledWith(item);
		expect(props.onOpenFallback).not.toHaveBeenCalled();
	});
	test("shows a goal and diagnostic label only for the matching session", async () => {
		const currentSession = {
			id: "session-1",
			sessionPurpose: "diagnostic" as const,
			goal: "Finde heraus, was du schon kannst.",
		};
		const screen = await render(
			<TodayLearningCard {...props} plan={{ ...plan, currentSession }} />,
		);
		expect(screen.getByText("Mathematik")).toBeTruthy();
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(
			"Wissenscheck",
		);
		expect(screen.getByText(currentSession.goal)).toBeTruthy();
		expect(screen.getByText(currentSession.goal).props.numberOfLines).toBe(2);
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(
			currentSession.goal,
		);
		await screen.rerender(
			<TodayLearningCard
				{...props}
				plan={{
					...plan,
					currentSession: { ...currentSession, id: "other-session" },
				}}
			/>,
		);
		expect(screen.queryByText(currentSession.goal)).toBeNull();
		expect(screen.getByText("Mathematik")).toBeTruthy();
	});
	test("shows actual completion counts instead of invented reference numbers", async () => {
		const screen = await render(
			<TodayLearningCard
				{...props}
				plan={{ ...plan, completedCount: 2, sessionCount: 7 }}
			/>,
		);
		expect(screen.getByText("2 von 7 Lernschritten")).toBeTruthy();
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(
			"5 Lernschritte noch offen",
		);
		expect(
			screen.getByTestId("today-learning-progress-ring", {
				includeHiddenElements: true,
			}).props.strokeDashoffset,
		).toBeCloseTo(2 * Math.PI * 23 * (1 - 2 / 7));
		expect(screen.queryByText(/9 von 12/)).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: /^Jetzt lernen/ }),
		);
		expect(props.onOpenItem).toHaveBeenCalledWith(item);
	});
	test("continues the existing started session", async () => {
		const started = {
			...item,
			entry: { ...item.entry, executionStatus: "started" as const },
		};
		const screen = await render(
			<TodayLearningCard {...props} item={started} />,
		);
		await fireEvent.press(screen.getByRole("button", { name: /^Fortsetzen/ }));
		expect(props.onOpenItem).toHaveBeenCalledWith(started);
	});
	test("disables navigation while loading", async () => {
		const screen = await render(<TodayLearningCard {...props} isLoading />);
		const button = screen.getByRole("button");
		expect(button.props.accessibilityState.disabled).toBe(true);
		await fireEvent.press(button);
		expect(props.onOpenItem).not.toHaveBeenCalled();
	});
	test.each([
		false,
		true,
	])("preserves the empty-state action with existing plans: %s", async (hasLearningPlans) => {
		const fallbackAction = getDashboardNextStepFallbackAction({
			hasLearningPlans,
		});
		const screen = await render(
			<TodayLearningCard
				{...props}
				item={undefined}
				plan={undefined}
				fallbackAction={fallbackAction}
			/>,
		);
		expect(
			screen.getByText(
				hasLearningPlans ? "Kein Lernschritt geplant" : "Noch kein Lernplan",
			),
		).toBeTruthy();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		expect(screen.getByTestId("today-learning-card").props.className).toContain(
			"bg-system-subtle",
		);
		expect(screen.queryByText(/Min\./)).toBeNull();
		expect(screen.queryByTestId("today-learning-progress-ring")).toBeNull();
		await fireEvent.press(screen.getByRole("button"));
		expect(
			screen.getByText(
				hasLearningPlans ? "Lernpläne öffnen" : "Jetzt Lernplan erstellen",
			),
		).toBeTruthy();
		expect(props.onOpenFallback).toHaveBeenCalledTimes(1);
		expect(props.onOpenItem).not.toHaveBeenCalled();
	});
	test("does not flash the no-plan prompt before data loads", async () => {
		const screen = await render(
			<TodayLearningCard
				{...props}
				item={undefined}
				plan={undefined}
				isLoading
			/>,
		);
		expect(screen.queryByText("Jetzt Lernplan erstellen")).toBeNull();
		expect(screen.getByRole("button").props.accessibilityState.disabled).toBe(
			true,
		);
	});
	test("reflows long content and does not invent missing metadata", async () => {
		mockStack = true;
		const title =
			"Ein besonders ausführliches Lernthema mit mehreren langen Fachbegriffen";
		const screen = await render(
			<TodayLearningCard
				{...props}
				plan={undefined}
				item={{
					...item,
					entry: { ...item.entry, title, durationMinutes: undefined },
				}}
			/>,
		);
		expect(screen.getByText(title).props.numberOfLines).toBeUndefined();
		expect(
			screen.getByTestId("today-learning-card-context").props.className,
		).toContain("flex-col");
		expect(screen.queryByText(/Min\./)).toBeNull();
		expect(screen.queryByText(/Klassenarbeit/)).toBeNull();
	});
});
