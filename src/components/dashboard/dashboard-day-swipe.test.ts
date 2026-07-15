import { describe, expect, test } from "vitest";
import { resolveDashboardDaySwipe } from "./dashboard-day-swipe";

describe("resolveDashboardDaySwipe", () => {
	test("moves to the previous day for a rightward swipe", () => {
		expect(resolveDashboardDaySwipe(64, 120)).toBe(-1);
	});

	test("moves to the next day for a leftward swipe", () => {
		expect(resolveDashboardDaySwipe(-64, -120)).toBe(1);
	});

	test("uses fling velocity when the swipe distance is short", () => {
		expect(resolveDashboardDaySwipe(18, 640)).toBe(-1);
		expect(resolveDashboardDaySwipe(-18, -640)).toBe(1);
	});

	test("ignores movement below both thresholds", () => {
		expect(resolveDashboardDaySwipe(30, 300)).toBe(0);
	});
});
