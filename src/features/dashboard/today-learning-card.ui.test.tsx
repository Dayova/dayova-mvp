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
		GraduationCap: (props: Record<string, unknown>) =>
			React.createElement("Icon", { ...props, name: "graduation-cap" }),
		Sparkles: icon,
		ArrowRightStraight: icon,
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
	todayKey: "2026-09-28",
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
	test("keeps short, long and loading cards at the same standard height", async () => {
		const screen = await render(<TodayLearningCard {...props} />);
		for (const title of ["Wissenscheck", "Gleichungen mit Klammern lösen"]) {
			await screen.rerender(
				<TodayLearningCard
					{...props}
					item={{ ...item, entry: { ...item.entry, title } }}
				/>,
			);
			const card = screen.getByTestId("today-learning-card");
			expect(card).toHaveStyle({ minHeight: 320 });
			expect(card).toHaveStyle({ height: 320 });
			expect(screen.getByText(title).props.numberOfLines).toBe(2);
		}
		await screen.rerender(<TodayLearningCard {...props} isLoading />);
		expect(screen.getByTestId("today-learning-card")).toHaveStyle({
			height: 320,
		});
	});
	test("chooses the subject glyph and graduation cap for creation", async () => {
		const screen = await render(<TodayLearningCard {...props} />);
		expect(
			screen.getByTestId("learning-illustration-icon", {
				includeHiddenElements: true,
			}).props.name,
		).toBe("calculator");
		await screen.rerender(
			<TodayLearningCard {...props} plan={{ subject: "Deutsch" }} />,
		);
		expect(
			screen.getByTestId("learning-illustration-icon", {
				includeHiddenElements: true,
			}).props.name,
		).toBe("pencil");
		await screen.rerender(
			<TodayLearningCard {...props} item={undefined} plan={undefined} />,
		);
		expect(
			screen.getByTestId("learning-illustration-icon", {
				includeHiddenElements: true,
			}).props.name,
		).toBe("graduation-cap");
	});
	test("shows topic and description without visible duration, with one action", async () => {
		const screen = await render(<TodayLearningCard {...props} />);
		expect(screen.queryByText("Mathematik")).toBeNull();
		expect(screen.queryByText(/Klassenarbeit/)).toBeNull();
		expect(screen.getByText("Gleichungen mit Klammern lösen")).toBeTruthy();
		expect(screen.queryByText("17 Minuten")).toBeNull();
		expect(screen.queryByTestId("today-subject-icon")).toBeNull();
		expect(
			screen.getByText("Gleichungen mit Klammern lösen").props.className,
		).toContain("text-body-1");
		expect(screen.queryByTestId("today-learning-play")).toBeNull();
		expect(screen.queryByText(/ca\./)).toBeNull();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		await fireEvent.press(
			screen.getByRole("button", { name: /^Lernsession starten/ }),
		);
		expect(props.onOpenItem).toHaveBeenCalledWith(item);
		expect(props.onOpenFallback).not.toHaveBeenCalled();
	});
	test("summarizes long goals while keeping the full goal accessible", async () => {
		const goal =
			"Löse Aufgaben zu Gleichungen mit Klammern lösen mit einer passenden Strategie.";
		const screen = await render(
			<TodayLearningCard
				{...props}
				plan={{ ...plan, currentSession: { id: "session-1", goal } }}
			/>,
		);
		expect(
			screen.getByText(
				"Festige dein Wissen mit passenden Aufgaben zu diesem Thema.",
			),
		).toBeTruthy();
		expect(screen.queryByText(goal)).toBeNull();
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(goal);
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
		expect(screen.queryByText("Mathematik")).toBeNull();
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(
			"Wissenscheck",
		);
		expect(screen.getByText(currentSession.goal)).toBeTruthy();
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
		expect(screen.queryByText("Mathematik")).toBeNull();
	});
	test("omits completion counts and ring while preserving the learning action", async () => {
		const screen = await render(
			<TodayLearningCard
				{...props}
				plan={{ ...plan, completedCount: 2, sessionCount: 7 }}
			/>,
		);
		expect(screen.queryByText("2 von 7 Lernschritten")).toBeNull();
		expect(screen.getByRole("button").props.accessibilityLabel).not.toContain(
			"Lernschritte noch offen",
		);
		expect(
			screen.queryByTestId("today-learning-progress-ring", {
				includeHiddenElements: true,
			}),
		).toBeNull();
		expect(screen.queryByText(/9 von 12/)).toBeNull();
		await fireEvent.press(
			screen.getByRole("button", { name: /^Lernsession starten/ }),
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
		await fireEvent.press(
			screen.getByRole("button", { name: /^Weiterlernen/ }),
		);
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
		if (!hasLearningPlans)
			expect(
				screen.getByTestId("today-learning-card").props.className,
			).toContain("bg-system-subtle");
		expect(screen.queryByText(/Min\./)).toBeNull();
		expect(screen.queryByTestId("today-learning-progress-ring")).toBeNull();
		await fireEvent.press(screen.getByRole("button"));
		expect(
			screen.getByText(
				hasLearningPlans ? "Lernpläne ansehen" : "Jetzt Lernplan erstellen",
			),
		).toBeTruthy();
		expect(props.onOpenFallback).toHaveBeenCalledTimes(1);
		expect(props.onOpenItem).not.toHaveBeenCalled();
	});
	test.each([
		["2026-09-28", "Heute"],
		["2026-09-29", "Morgen"],
		["2026-10-01", "1. Okt."],
	])("labels the actual learning day %s", async (dayKey, label) => {
		const screen = await render(
			<TodayLearningCard {...props} item={{ ...item, dayKey }} />,
		);
		if (dayKey === props.todayKey) expect(screen.queryByText(label)).toBeNull();
		else expect(screen.queryByText(`${label} · 17 Minuten`)).toBeNull();
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(
			label,
		);
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
			screen.getByTestId("today-learning-card").props.className,
		).not.toContain("h-56");
		expect(
			screen.getByTestId("today-learning-card-context").props.className,
		).toContain("gap-1");
		expect(screen.queryByText(/Min\./)).toBeNull();
		expect(screen.queryByText(/Klassenarbeit/)).toBeNull();
	});
});
