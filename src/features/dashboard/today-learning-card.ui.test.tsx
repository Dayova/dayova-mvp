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
	return { ArrowUpRight: icon, GraduationCap: icon };
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
		expect(screen.getByText("Klassenarbeit · 5. Oktober 2026")).toBeTruthy();
		expect(screen.getByText("Gleichungen mit Klammern lösen")).toBeTruthy();
		expect(screen.getByText("ca. 17 Min.")).toBeTruthy();
		expect(screen.getAllByRole("button")).toHaveLength(1);
		await fireEvent.press(
			screen.getByRole("button", { name: /^Jetzt lernen/ }),
		);
		expect(props.onOpenItem).toHaveBeenCalledWith(item);
		expect(props.onOpenFallback).not.toHaveBeenCalled();
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
		expect(screen.getByText("Noch kein Lernschritt geplant")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button"));
		expect(screen.getByText(fallbackAction.label)).toBeTruthy();
		expect(props.onOpenFallback).toHaveBeenCalledTimes(1);
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
