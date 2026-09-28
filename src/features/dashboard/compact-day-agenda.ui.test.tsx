import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import type { Id } from "#convex/_generated/dataModel";
import { CompactDayAgenda } from "./compact-day-agenda";
import { toDashboardAgendaItem } from "./dashboard-agenda";

jest.mock("~/components/ui/icon", () => ({
	Check: () => null,
	ArrowRight: () => null,
}));
jest.mock("~/features/subjects/subject-catalog", () => ({
	getSubjectIcon: () => () => null,
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { primaryStrong: "#00A0E6" } }),
}));
jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: false }),
}));
const item = toDashboardAgendaItem("2026-09-01", {
	id: "session" as Id<"learningPlanSessions">,
	relatedLearningPlanSessionId: "session" as Id<"learningPlanSessions">,
	subject: "Mathematik",
	title: "Mathematik Gleichungen lösen",
	time: "17:00",
	durationMinutes: 17,
});

describe("CompactDayAgenda", () => {
	test("shows subject, topic and metadata and opens the entry", async () => {
		const open = jest.fn();
		const screen = await render(
			<CompactDayAgenda items={[item]} isLoading={false} onOpenItem={open} />,
		);
		expect(
			screen.getByText("Mathematik · Gleichungen lösen").props.numberOfLines,
		).toBe(1);
		expect(screen.getByText("17:00 · 17 min").props.numberOfLines).toBe(1);
		expect(screen.getByRole("button").props.accessibilityLabel).toContain(
			"Gleichungen lösen",
		);
		expect(screen.queryByText("Dein Lernschritt")).toBeNull();
		expect(
			screen.queryByTestId("agenda-completed", { includeHiddenElements: true }),
		).toBeNull();
		await fireEvent.press(screen.getByRole("button"));
		expect(open).toHaveBeenCalledWith(item);
		expect(
			screen.getByTestId("agenda-open-arrow", { includeHiddenElements: true }),
		).toBeTruthy();
	});
	test.each([
		"completed",
		"notStarted",
		"started",
		"missed",
		"partiallyCompleted",
	] as const)("marks only truly completed sessions: %s", async (executionStatus) => {
		const screen = await render(
			<CompactDayAgenda
				items={[{ ...item, entry: { ...item.entry, executionStatus } }]}
				isLoading={false}
				onOpenItem={jest.fn()}
			/>,
		);
		expect(
			Boolean(
				screen.queryByTestId("agenda-completed", {
					includeHiddenElements: true,
				}),
			),
		).toBe(executionStatus === "completed");
		expect(
			Boolean(
				screen.queryByTestId("agenda-open-arrow", {
					includeHiddenElements: true,
				}),
			),
		).toBe(executionStatus !== "completed");
	});
	test("uses quiet empty copy and does not flash it while loading", async () => {
		const screen = await render(
			<CompactDayAgenda items={[]} isLoading={false} onOpenItem={jest.fn()} />,
		);
		expect(screen.getByText("Für diesen Tag ist nichts geplant.")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
		await screen.rerender(
			<CompactDayAgenda items={[]} isLoading onOpenItem={jest.fn()} />,
		);
		expect(screen.queryByText("Für diesen Tag ist nichts geplant.")).toBeNull();
	});
	test("school lessons remain non-interactive", async () => {
		const screen = await render(
			<CompactDayAgenda
				items={[{ ...item, kind: "schoolLesson" }]}
				isLoading={false}
				onOpenItem={jest.fn()}
			/>,
		);
		expect(screen.queryByRole("button")).toBeNull();
	});
});
