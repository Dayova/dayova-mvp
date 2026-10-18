import { describe, expect, it } from "vitest";
import type { DayEntry } from "~/types/dayEntries";
import {
	classifyAgendaEntry,
	getDashboardCalendarDayKeys,
	getDashboardRelevantDayKeys,
	getDashboardWeekDayKeys,
	getDashboardWeekSelection,
	getVisibleDashboardEntries,
	hasDashboardDayEntries,
	sortDashboardAgendaItems,
	toDashboardAgendaItem,
} from "./dashboard-agenda";

const entry = (overrides: Partial<DayEntry>): DayEntry =>
	({
		id: "entry-id",
		title: "Aufgabe",
		...overrides,
	}) as DayEntry;

describe("dashboard agenda", () => {
	it.each([
		["2026-09-28", -1, "2026-09-25"],
		["2026-10-04", 1, "2026-10-05"],
		["2026-09-26", 1, "2026-10-03"],
		["2026-10-03", -1, "2026-09-26"],
	])("selects an available day when moving from %s by %i weeks", (selectedDayKey, weekDelta, expected) => {
		const dayPagerKeys = getDashboardCalendarDayKeys({
			anchorDayKey: "2026-10-01",
			radiusInDays: 6,
		});
		expect(
			getDashboardWeekSelection({ selectedDayKey, weekDelta, dayPagerKeys }),
		).toBe(expected);
	});

	it("does not select a day outside the calendar window", () => {
		expect(
			getDashboardWeekSelection({
				selectedDayKey: "2026-10-01",
				weekDelta: 10,
				dayPagerKeys: ["2026-10-01"],
			}),
		).toBeUndefined();
	});

	it("marks days with open or completed entries, but not empty or timetable-only days", () => {
		expect(hasDashboardDayEntries(undefined)).toBe(false);
		expect(hasDashboardDayEntries([])).toBe(false);
		expect(
			hasDashboardDayEntries([entry({ executionStatus: "notStarted" })]),
		).toBe(true);
		expect(
			hasDashboardDayEntries([entry({ executionStatus: "completed" })]),
		).toBe(true);
		expect(hasDashboardDayEntries([entry({ completed: true })])).toBe(true);
		expect(hasDashboardDayEntries([entry({ source: "timetable" })])).toBe(
			false,
		);
	});

	it("loads every day in a selected historical week for entry markers", () => {
		const keys = getDashboardRelevantDayKeys({
			selectedDayKey: "2026-08-12",
			todayKey: "2026-09-29",
		});
		for (const key of [
			"2026-08-10",
			"2026-08-11",
			"2026-08-12",
			"2026-08-13",
			"2026-08-14",
			"2026-08-15",
			"2026-08-16",
		])
			expect(keys).toContain(key);
		expect(keys.length).toBeLessThanOrEqual(31);
	});

	it("shows the Monday-to-Sunday week containing the selected day", () => {
		expect(getDashboardWeekDayKeys("2026-07-29")).toEqual([
			"2026-07-27",
			"2026-07-28",
			"2026-07-29",
			"2026-07-30",
			"2026-07-31",
			"2026-08-01",
			"2026-08-02",
		]);
	});

	it("builds a balanced range for the horizontally paged day content", () => {
		expect(
			getDashboardCalendarDayKeys({
				anchorDayKey: "2026-07-29",
				radiusInDays: 2,
			}),
		).toEqual([
			"2026-07-27",
			"2026-07-28",
			"2026-07-29",
			"2026-07-30",
			"2026-07-31",
		]);
	});

	it("queries the current week, adjacent selected days, and upcoming learning-plan days", () => {
		expect(
			getDashboardRelevantDayKeys({
				selectedDayKey: "2026-08-12",
				todayKey: "2026-07-29",
				lookaheadDays: 2,
			}),
		).toEqual([
			"2026-07-27",
			"2026-07-28",
			"2026-07-29",
			"2026-07-30",
			"2026-07-31",
			"2026-08-01",
			"2026-08-02",
			"2026-08-10",
			"2026-08-11",
			"2026-08-12",
			"2026-08-13",
			"2026-08-14",
			"2026-08-15",
			"2026-08-16",
		]);
	});

	it("stays within the backend limit while keeping the selected day visible", () => {
		const keys = getDashboardRelevantDayKeys({
			selectedDayKey: "2027-08-12",
			todayKey: "2026-07-29",
			lookaheadDays: 60,
		});

		expect(keys).toHaveLength(31);
		expect(keys).toContain("2027-08-11");
		expect(keys).toContain("2027-08-12");
		expect(keys).toContain("2027-08-13");
		expect(keys).toContain("2026-07-29");
	});

	it("keeps passive lessons distinct from Dayova learning sessions", () => {
		expect(
			classifyAgendaEntry(entry({ title: "Mathematik", kind: "Schulstunde" })),
		).toBe("schoolLesson");
		expect(
			classifyAgendaEntry(
				entry({
					title: "Theorie und Praxis",
					kind: "Unterricht",
					source: "timetable",
				}),
			),
		).toBe("schoolLesson");
		expect(
			classifyAgendaEntry(
				entry({
					title: "Mathematik • Gleichungen",
					kind: "Lernen",
					relatedLearningPlanSessionId:
						"session-id" as DayEntry["relatedLearningPlanSessionId"],
				}),
			),
		).toBe("learningSession");
	});

	it("orders all-day items before timed items", () => {
		const items = [
			toDashboardAgendaItem(
				"2026-07-23",
				entry({ id: "late" as DayEntry["id"], time: "14:00" }),
			),
			toDashboardAgendaItem(
				"2026-07-23",
				entry({ id: "all-day" as DayEntry["id"] }),
			),
			toDashboardAgendaItem(
				"2026-07-23",
				entry({ id: "early" as DayEntry["id"], time: "08:00" }),
			),
		];

		expect(
			sortDashboardAgendaItems(items).map((item) => item.entry.id),
		).toEqual(["all-day", "early", "late"]);
	});
});

describe("focused learning agenda", () => {
	it("hides imported lessons while preserving homework, exams and learning sessions", () => {
		const lesson = entry({ source: "timetable", title: "Mathe" });
		const homework = entry({
			title: "Hausaufgaben zur Unterrichtsstunde",
			kind: "homework",
		});
		const exam = entry({ title: "Mathe", examTypeLabel: "Klausur" });
		const learning = entry({ title: "Mathe üben", kind: "practice" });
		expect(
			getVisibleDashboardEntries([lesson, homework, exam, learning]),
		).toEqual([homework, exam, learning]);
		expect(getVisibleDashboardEntries([lesson])).toEqual([]);
	});
});
