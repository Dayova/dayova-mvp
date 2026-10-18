/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { calculateAvailableStudyMinutes } from "./learningPlanAvailability";
import { parseLearningTimeToMinutes } from "./learningSessionScheduleFormatting";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
test("midnight is an exclusive planning boundary", () => {
	expect(parseLearningTimeToMinutes("24:00")).toBe(1440);
	expect(parseLearningTimeToMinutes("24:01")).toBeNull();
	expect(
		calculateAvailableStudyMinutes({
			fromDateKey: "2026-10-05",
			examDateKey: "2026-10-06",
			learningTimes: [{ dayOfWeek: 1, startTime: "23:00", endTime: "24:00" }],
		}),
	).toBe(60);
});
test("no manual times: availability and AI context remain empty even with a grade", async () => {
	const t = convexTest(schema, modules).withIdentity({
		tokenIdentifier: "test:defaults",
		subject: "defaults",
		email: "defaults@example.com",
	});
	await t.mutation(api.users.syncCurrentUser, { grade: "9" });
	expect(await t.query(api.learningTimes.listMine, {})).toEqual([]);
	expect(
		await t.query(api.learningPlans.getSchedulingAvailability, {
			fromDateKey: "2026-10-05",
			fromTimeMinutes: 17 * 60,
			examDateKey: "2026-10-06",
		}),
	).toMatchObject({ status: "missing", availableStudyMinutes: 0 });
	expect(await t.query(api.learningTimes.listForPlanning, {})).toEqual([]);
	expect(
		await t.query(api.learningPlans.getSchedulingAvailability, {
			fromDateKey: "2026-10-05",
			fromTimeMinutes: 9 * 60,
			examDateKey: "2026-10-12",
		}),
	).toMatchObject({ status: "missing", availableStudyMinutes: 0 });
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-10-12",
		title: "Mathematik Test",
		kind: "Leistungskontrolle",
		time: "09:00",
		durationMinutes: 45,
	});
	const learningPlanId = await t.mutation(api.learningPlans.createDraft, {
		examDayEntryId,
		subject: "Mathematik",
		examTypeLabel: "Test",
		examDateKey: "2026-10-12",
		examDateLabel: "12. Oktober 2026",
		durationMinutes: 45,
		topicDescription: "Lineare Funktionen",
	});
	expect(
		(await t.query(internal.learningPlans.getAiContext, { learningPlanId }))
			.learningTimes,
	).toEqual([]);
	expect(await t.query(api.learningTimes.listMine, {})).toEqual([]);
});
test("personal times remain isolated by owner", async () => {
	const backend = convexTest(schema, modules);
	const owner = backend.withIdentity({ tokenIdentifier: "test:owner" });
	const other = backend.withIdentity({ tokenIdentifier: "test:other" });
	await owner.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "18:00",
		endTime: "19:00",
	});
	expect(await owner.query(api.learningTimes.listForPlanning, {})).toEqual([
		{ dayOfWeek: 2, startTime: "18:00", endTime: "19:00" },
	]);
	expect(await other.query(api.learningTimes.listForPlanning, {})).toEqual([]);
	await expect(
		backend.query(api.learningTimes.listForPlanning, {}),
	).rejects.toThrow();
});
