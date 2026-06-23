/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type TestBackend = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

const studentIdentity = {
	subject: "student",
	tokenIdentifier: "test:student",
	email: "student@example.com",
};

const founderIdentity = {
	subject: "founder",
	tokenIdentifier: "test:founder",
	email: "founder@example.com",
};

const createAcceptedPlanWithSession = async (t: TestBackend) => {
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-05",
		title: "Mathe Klausur",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. Juni 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});
	const learningPlanId = await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-06-05",
		examDateLabel: "5. Juni 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: "Lineare Funktionen",
	});
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Testmaterial",
		insight: { summary: "Bereit zum Lernen.", strengths: [], gaps: [] },
		sessions: [
			{
				phase: "practice",
				title: "Üben",
				dateKey: "2026-06-01",
				dateLabel: "1. Juni 2026",
				startTime: "17:00",
				durationMinutes: 30,
				goal: "Kurz wiederholen.",
				tasks: ["Begriffe prüfen", "Aufgaben lösen"],
				expectedOutcome: "Du bist vorbereitet.",
			},
		],
	});
	await t.mutation(api.learningPlans.acceptPlan, { learningPlanId });
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const session = snapshot?.sessions[0];
	if (!session) throw new Error("Expected an accepted learning plan session.");
	return { learningPlanId, session };
};

test("validation next-day returns are captured once per local day", async () => {
	const t = convexTest(schema, modules).withIdentity(studentIdentity);
	await t.mutation(api.users.syncCurrentUser, {
		name: "Student",
		validationStudentCode: "STU-001",
	});

	await t.mutation(api.validationAnalytics.markActivity, {
		localDayKey: "2026-06-01",
	});
	const firstReturn = await t.mutation(
		api.validationAnalytics.markReturnedNextDay,
		{ localDayKey: "2026-06-02" },
	);
	expect(firstReturn).toEqual({
		captured: true,
		validationStudentCode: "STU-001",
		previousActivityDayKey: "2026-06-01",
	});

	const duplicateReturn = await t.mutation(
		api.validationAnalytics.markReturnedNextDay,
		{ localDayKey: "2026-06-02" },
	);
	expect(duplicateReturn).toMatchObject({
		captured: false,
		previousActivityDayKey: "2026-06-01",
	});
});

test("validation daily overview is founder-only and records attribution", async () => {
	const t = convexTest(schema, modules);
	const studentT = t.withIdentity(studentIdentity);
	await studentT.mutation(api.users.syncCurrentUser, {
		name: "Student",
		validationStudentCode: "STU-001",
	});
	const { session } = await createAcceptedPlanWithSession(studentT);

	await expect(
		studentT.query(api.validationAnalytics.dailyOverview, {
			dayKey: "2026-06-01",
		}),
	).rejects.toThrow("Kein Zugriff auf die Validierungsübersicht.");

	const founderT = t.withIdentity(founderIdentity);
	const founderUserId = await founderT.mutation(api.users.syncCurrentUser, {
		name: "Founder",
	});
	await t.run(async (ctx) => {
		await ctx.db.patch("users", founderUserId, {
			validationRole: "founder",
		});
	});

	const overview = await founderT.query(api.validationAnalytics.dailyOverview, {
		dayKey: "2026-06-01",
	});
	expect(overview.rows).toHaveLength(1);
	expect(overview.rows[0]).toMatchObject({
		sessionId: session.id,
		validationStudentCode: "STU-001",
		status: "notStarted",
		needsCheckIn: true,
		attribution: null,
	});

	await founderT.mutation(api.validationAnalytics.recordAttribution, {
		sessionId: session.id,
		source: "product_only",
		note: "Student completed this without founder help.",
	});

	const updatedOverview = await founderT.query(
		api.validationAnalytics.dailyOverview,
		{ dayKey: "2026-06-01" },
	);
	expect(updatedOverview.rows[0]?.attribution).toMatchObject({
		source: "product_only",
		note: "Student completed this without founder help.",
	});
});
