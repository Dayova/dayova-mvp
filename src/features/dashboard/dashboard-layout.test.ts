import { describe, expect, test } from "vitest";
import {
	getDashboardScreenLayout,
	getDashboardSummaryCardLayoutClass,
} from "./dashboard-layout";

describe("getDashboardScreenLayout", () => {
	test("stacks dashboard cards and tightens the header on phones", () => {
		expect(
			getDashboardScreenLayout({ fontScale: 1, viewportWidth: 393 }),
		).toEqual({
			headerCalendarGap: 24,
			summaryCardLayout: "stacked",
		});
	});

	test("keeps cards side by side on tablets with regular text", () => {
		expect(
			getDashboardScreenLayout({ fontScale: 1, viewportWidth: 768 }),
		).toMatchObject({ summaryCardLayout: "side-by-side" });
	});

	test("stacks cards on tablets when system text is enlarged", () => {
		expect(
			getDashboardScreenLayout({ fontScale: 1.3, viewportWidth: 768 }),
		).toMatchObject({ summaryCardLayout: "stacked" });
	});

	test("gives stacked cards the full available width", () => {
		expect(getDashboardSummaryCardLayoutClass("stacked")).toBe("w-full");
		expect(getDashboardSummaryCardLayoutClass("side-by-side")).toBe("flex-1");
	});
});
