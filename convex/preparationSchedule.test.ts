import { describe, expect, test } from "vitest";
import {
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
	test("five correct or incorrect answers never change the product budget", () => {
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
		expect(slots.some((s) => s.dateKey === "2026-10-12")).toBe(false);
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
		expect(slots.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(30);
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

test("uses the full explicitly preferred window rather than silently capping it", () => {
	const slots = proposePreparationSchedule({
		examTypeLabel: "Klausur",
		examDateKey: "2026-10-06",
		now: { dateKey: "2026-10-05", minutes: 840 },
		learningTimes: [{ dayOfWeek: 1, startTime: "20:00", endTime: "24:00" }],
		occupiedEntries: [],
	});
	expect(slots.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(240);
	expect(slots[0].startTime).toBe("20:00");
});
