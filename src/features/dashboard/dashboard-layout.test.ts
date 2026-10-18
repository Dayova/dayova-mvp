import { describe, expect, test } from "vitest";
import { getDashboardScreenLayout } from "./dashboard-layout";

describe("getDashboardScreenLayout", () => {
	test("stacks dashboard cards and tightens the header on phones", () => {
		expect(
			getDashboardScreenLayout({ fontScale: 1, viewportWidth: 393 }),
		).toMatchObject({
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
});
