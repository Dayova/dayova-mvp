import { describe, expect, test } from "vitest";
import { ROUTES } from "~/lib/routes";
import { EMPTY_DASHBOARD_PRIMARY_ACTION } from "./dashboard-empty-state";

describe("empty dashboard handoff", () => {
	test("takes a newly onboarded learner directly to their first exam", () => {
		expect(EMPTY_DASHBOARD_PRIMARY_ACTION).toMatchObject({
			label: "Erste Prüfung planen",
			route: ROUTES.createExam,
		});
	});
});
