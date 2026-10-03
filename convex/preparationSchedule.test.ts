import { describe, expect, test } from "vitest";
import {
	diagnosticPreparationBudget,
	preparationBudget,
	recommendLearningPreparation,
} from "./learningPreparationPolicy";
import {
	berlinNow,
	proposePreparationSchedule,
	splitPreparationSlot,
	validatePreparationSlots,
} from "./preparationSchedule";

const defaults = {
	examTypeLabel: "Klassenarbeit",
	examDateKey: "2026-10-19",
	now: { dateKey: "2026-10-05", minutes: 600 },
	learningTimes: [{ dayOfWeek: 1, startTime: "17:00", endTime: "17:30" }],
	occupiedEntries: [],
};
describe("fixed preparation and scheduling", () => {
	test.each([
		["Test", 60],
		["Klassenarbeit", 180],
		["Klausur", 240],
		["Mündliche Prüfung", 120],
		["Präsentation", 240],
		["Vorabitur", 720],
		["Abitur mündlich", 1800],
		["Eigene Prüfung", 120],
	])("%s uses %s minutes", (type, minutes) =>
		expect(preparationBudget(String(type)).minutes).toBe(minutes));
	test("legacy recommendation without a completed diagnostic uses the base budget", () => {
		for (const secure of [0, 5])
			expect(
				recommendLearningPreparation({
					examTypeLabel: "Abitur",
					examDurationMinutes: 90,
					preparationDepth: "compact",
					topicReadiness: { secure, developing: 0, unknown: 5 - secure },
				}).recommendedMinutes,
			).toBe(1800);
	});
	test("adds days at the familiar time without changing recurring preferences", () => {
		const times = structuredClone(defaults.learningTimes);
		const slots = proposePreparationSchedule(defaults);
		expect(slots.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(180);
		expect(slots.some((s) => new Date(s.dateKey).getUTCDay() !== 1)).toBe(true);
		expect(slots.every((s) => s.startTime === "17:00")).toBe(true);
		expect(defaults.learningTimes).toEqual(times);
	});
	test("respects school/calendar intervals and excludes past times", () => {
		const slots = proposePreparationSchedule({
			...defaults,
			now: { dateKey: "2026-10-05", minutes: 1025 },
			occupiedEntries: [
				{ dayKey: "2026-10-12", time: "17:00", durationMinutes: 60 },
			],
		});
		expect(slots.find((s) => s.dateKey === "2026-10-05")?.startTime).toBe(
			"17:10",
		);
		expect(
			slots
				.filter((s) => s.dateKey === "2026-10-12")
				.every((s) => s.startTime < "16:30" || s.startTime >= "18:00"),
		).toBe(true);
	});
	test("Abitur starts early and is spread across months", () => {
		const slots = proposePreparationSchedule({
			...defaults,
			examTypeLabel: "Abitur",
			examDateKey: "2027-01-25",
			learningTimes: [1, 3, 5].map((dayOfWeek) => ({
				dayOfWeek,
				startTime: "17:00",
				endTime: "17:45",
			})),
		});
		expect(slots.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(1800);
		expect(slots[0].dateKey < "2026-10-15").toBe(true);
		expect((slots.at(-1)?.dateKey ?? "") > "2027-01-10").toBe(true);
		expect(new Set(slots.map((s) => s.dateKey.slice(0, 7))).size).toBe(4);
	});
	test("short notice exposes less capacity rather than overbooking", () => {
		const slots = proposePreparationSchedule({
			...defaults,
			examDateKey: "2026-10-06",
		});
		expect(slots.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(120);
	});
	test("validates cross-midnight, overlap and impossible calendar dates", () => {
		const slot = {
			id: "a",
			dateKey: "2026-10-10",
			startTime: "17:00",
			durationMinutes: 30,
		};
		expect(validatePreparationSlots([slot], defaults.examDateKey)).toBeNull();
		expect(
			validatePreparationSlots(
				[slot, { ...slot, id: "b", startTime: "17:10" }],
				defaults.examDateKey,
			),
		).toContain("überschneiden");
		expect(
			validatePreparationSlots(
				[{ ...slot, startTime: "23:50" }],
				defaults.examDateKey,
			),
		).not.toBeNull();
		expect(
			validatePreparationSlots(
				[{ ...slot, dateKey: "2026-02-30" }],
				defaults.examDateKey,
			),
		).not.toBeNull();
	});
	test("splits one 30 minute appointment into three achievable steps", () =>
		expect(
			splitPreparationSlot({
				id: "a",
				dateKey: "2026-10-10",
				startTime: "17:00",
				durationMinutes: 30,
			}),
		).toEqual([
			{ startTime: "17:00", durationMinutes: 10 },
			{ startTime: "17:10", durationMinutes: 10 },
			{ startTime: "17:20", durationMinutes: 10 },
		]));
	test("Berlin clock accounts for DST", () => {
		expect(berlinNow(new Date("2026-10-25T01:30:00Z"))).toEqual({
			dateKey: "2026-10-25",
			minutes: 150,
		});
	});
});

test("caps automatically planned days at two hours", () => {
	const slots = proposePreparationSchedule({
		examTypeLabel: "Klausur",
		examDateKey: "2026-10-06",
		now: { dateKey: "2026-10-05", minutes: 840 },
		learningTimes: [{ dayOfWeek: 1, startTime: "20:00", endTime: "24:00" }],
		occupiedEntries: [],
	});
	expect(slots.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(120);
	expect(slots[0].startTime).toBe("20:00");
});

test.each([
	[10, 135],
	[9, 135],
	[8, 180],
	[7, 180],
	[6, 225],
	[4, 225],
	[3, 270],
	[0, 270],
])("%i correct yields %i total minutes", (correct, total) => {
	const budget = diagnosticPreparationBudget("Klassenarbeit", correct, 10, 900);
	expect(budget.totalMinutes).toBe(total);
	expect(budget.remainingMinutes).toBe(total - 15);
	expect(budget.diagnosticMinutes).toBe(15);
});
test.each([
	[7, 180],
	[3, 180],
	[1, 120],
])("distributes across %i days with bounded capacity", (days, expected) => {
	const date = new Date("2026-10-05T12:00:00Z");
	date.setUTCDate(date.getUTCDate() + days);
	const slots = proposePreparationSchedule({
		...defaults,
		examDateKey: date.toISOString().slice(0, 10),
		budgetMinutes: 180,
	});
	expect(slots.reduce((n, s) => n + s.durationMinutes, 0)).toBe(expected);
	for (const day of new Set(slots.map((s) => s.dateKey)))
		expect(
			slots
				.filter((s) => s.dateKey === day)
				.reduce((n, s) => n + s.durationMinutes, 0),
		).toBeLessThanOrEqual(120);
	expect(validatePreparationSlots(slots, date.toISOString())).toBeNull();
});
test("late same-day start finds future capacity after the preferred time", () => {
	const slots = proposePreparationSchedule({
		...defaults,
		examDateKey: "2026-10-06",
		now: { dateKey: "2026-10-05", minutes: 1200 },
		budgetMinutes: 120,
	});
	expect(slots.length).toBeGreaterThan(0);
	expect(slots.every((s) => s.startTime > "20:00")).toBe(true);
	expect(slots.reduce((n, s) => n + s.durationMinutes, 0)).toBeLessThan(120);
});
test("credited diagnostic never produces a negative remaining budget", () =>
	expect(
		diagnosticPreparationBudget("Test", 10, 10, 100000).remainingMinutes,
	).toBe(0));

test("large adjusted budgets stay within the calendar slot limit", () => {
	const slots = proposePreparationSchedule({
		...defaults,
		examTypeLabel: "Abitur",
		examDateKey: "2027-01-25",
		budgetMinutes: 2700,
		learningTimes: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
			dayOfWeek,
			startTime: "16:00",
			endTime: "18:00",
		})),
	});
	expect(slots.length).toBeLessThanOrEqual(180);
	expect(validatePreparationSlots(slots, "2027-01-25")).toBeNull();
});
