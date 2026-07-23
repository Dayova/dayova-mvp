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

	it("shows the fixed Sunday-to-Saturday week containing the selected day", () => {
		expect(getDashboardWeekDayKeys("2026-07-29")).toEqual([
			"2026-07-26",
			"2026-07-27",
			"2026-07-28",
			"2026-07-29",
			"2026-07-30",
			"2026-07-31",
			"2026-08-01",
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

	it("queries adjacent selected days and upcoming learning-plan days", () => {
		expect(
			getDashboardRelevantDayKeys({
				selectedDayKey: "2026-08-12",
				todayKey: "2026-07-29",
				lookaheadDays: 2,
			}),
		).toEqual([
			"2026-07-29",
			"2026-07-30",
			"2026-07-31",
			"2026-08-11",
			"2026-08-12",
			"2026-08-13",
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
