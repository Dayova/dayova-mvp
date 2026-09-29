import { describe, expect, it } from "vitest";
import type { DayEntry } from "~/types/dayEntries";
import {
	classifyAgendaEntry,
	findNextActionableAgendaItem,
	findNextActionableAgendaItemId,
	getAdjacentDashboardDayKey,
	getDashboardCalendarDayKeys,
	getDashboardRelevantDayKeys,
	getDashboardWeekDayKeys,
	getDashboardWeekProgress,
	getNextLearningStepAccessibilityLabel,
	getVisibleDashboardEntries,
	hasDashboardDayEntries,
	isDashboardAgendaItemPast,
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
		for (const key of getDashboardWeekDayKeys("2026-08-12"))
			expect(keys).toContain(key);
		expect(keys.length).toBeLessThanOrEqual(31);
	});
	it("keeps today's overdue open step ahead of tomorrow and skips completed steps", () => {
		const today = toDashboardAgendaItem(
			"2026-09-28",
			entry({ kind: "Lernen", time: "08:00", executionStatus: "started" }),
		);
		const tomorrow = toDashboardAgendaItem(
			"2026-09-29",
			entry({ kind: "Lernen", time: "09:00" }),
		);
		const select = (items: (typeof today)[]) =>
			findNextActionableAgendaItem({
				items,
				todayKey: "2026-09-28",
				currentMinutes: 20 * 60,
			});
		expect(select([tomorrow, today])).toBe(today);
		expect(
			select([
				tomorrow,
				{ ...today, entry: { ...today.entry, executionStatus: "completed" } },
			]),
		).toBe(tomorrow);
		expect(
			select([
				{
					...today,
					entry: {
						...today.entry,
						executionStatus: undefined,
						completed: true,
					},
				},
			]),
		).toBeUndefined();
		expect(select([{ ...today, dayKey: "2026-09-27" }])).toBeUndefined();
	});
	it("omits unavailable date and time details from the next-step announcement", () => {
		expect(
			getNextLearningStepAccessibilityLabel({
				isStarted: false,
				title: "Lineare Funktionen",
				dateLabel: null,
				timeLabel: null,
			}),
		).toBe("Nächsten Lernschritt öffnen: Lineare Funktionen");
		expect(
			getNextLearningStepAccessibilityLabel({
				isStarted: true,
				title: "Lineare Funktionen",
				dateLabel: "Heute",
				timeLabel: "16:00 Uhr",
			}),
		).toBe("Weiterlernen: Lineare Funktionen. Heute, 16:00 Uhr");
	});

	it("moves to the adjacent day in the direction of the user's swipe", () => {
		expect(
			getAdjacentDashboardDayKey({
				selectedDayKey: "2026-07-24",
				direction: "next",
			}),
		).toBe("2026-07-25");
		expect(
			getAdjacentDashboardDayKey({
				selectedDayKey: "2026-07-24",
				direction: "previous",
			}),
		).toBe("2026-07-23");
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

	it("summarizes completed learning sessions in the current week", () => {
		const items = [
			toDashboardAgendaItem(
				"2026-07-27",
				entry({
					id: "completed-before-today" as DayEntry["id"],
					kind: "Lernen",
					completed: true,
					durationMinutes: 25,
				}),
			),
			toDashboardAgendaItem(
				"2026-07-29",
				entry({
					id: "completed-today" as DayEntry["id"],
					kind: "Lernen",
					executionStatus: "completed",
					durationMinutes: 35,
				}),
			),
			toDashboardAgendaItem(
				"2026-07-30",
				entry({
					id: "upcoming" as DayEntry["id"],
					kind: "Lernen",
					durationMinutes: 20,
				}),
			),
			toDashboardAgendaItem(
				"2026-07-29",
				entry({
					id: "homework" as DayEntry["id"],
					kind: "Hausaufgabe",
					completed: true,
					durationMinutes: 90,
				}),
			),
			toDashboardAgendaItem(
				"2026-08-03",
				entry({
					id: "next-week" as DayEntry["id"],
					kind: "Lernen",
					completed: true,
					durationMinutes: 45,
				}),
			),
		];

		expect(
			getDashboardWeekProgress({
				items,
				todayKey: "2026-07-29",
			}),
		).toEqual({
			completedLearningSessions: 2,
			completedMinutesToday: 35,
			completionPercent: 67,
			remainingLearningSessions: 1,
			totalLearningSessions: 3,
		});
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

	it("fades completed and elapsed items", () => {
		expect(
			isDashboardAgendaItemPast({
				item: toDashboardAgendaItem(
					"2026-07-23",
					entry({ time: "08:00", durationMinutes: 45 }),
				),
				todayKey: "2026-07-23",
				currentMinutes: 9 * 60,
			}),
		).toBe(true);
		expect(
			isDashboardAgendaItemPast({
				item: toDashboardAgendaItem(
					"2026-07-24",
					entry({ time: "08:00", durationMinutes: 45 }),
				),
				todayKey: "2026-07-23",
				currentMinutes: 9 * 60,
			}),
		).toBe(false);
	});

	it("never promotes a passive lesson as the next action", () => {
		const items = [
			toDashboardAgendaItem(
				"2026-07-23",
				entry({
					id: "lesson" as DayEntry["id"],
					kind: "Schulstunde",
					time: "10:00",
				}),
			),
			toDashboardAgendaItem(
				"2026-07-23",
				entry({
					id: "learning" as DayEntry["id"],
					kind: "Lernen",
					time: "11:00",
				}),
			),
		];

		expect(
			findNextActionableAgendaItemId({
				items,
				todayKey: "2026-07-23",
				currentMinutes: 9 * 60,
			}),
		).toBe("learning");
	});

	it("promotes the earliest actionable learning session across days", () => {
		const items = [
			toDashboardAgendaItem(
				"2026-07-25",
				entry({
					id: "later" as DayEntry["id"],
					kind: "Lernen",
					time: "09:00",
				}),
			),
			toDashboardAgendaItem(
				"2026-07-24",
				entry({
					id: "earlier" as DayEntry["id"],
					kind: "Lernen",
					time: "18:00",
				}),
			),
		];

		expect(
			findNextActionableAgendaItem({
				items,
				todayKey: "2026-07-24",
				currentMinutes: 12 * 60,
			})?.entry.id,
		).toBe("earlier");
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
