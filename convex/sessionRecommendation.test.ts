/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { tokenIdentifier: "day424:synthetic" };
async function fixture(normalizeDates = false, commitPractice = false) {
	const t = convexTest(schema, modules).withIdentity(identity);
	const ids = await t.run(async (ctx) => {
		const now = Date.UTC(2026, 8, 15, 16);
		const plan = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			subject: "Mathematik",
			examTypeLabel: "Klassenarbeit",
			examDateKey: "2026-09-28",
			examDateLabel: "28. September",
			durationMinutes: 30,
			topicDescription: "Umsatzsteuer",
			status: "accepted",
			createdAt: now,
			updatedAt: now,
		});
		const base = {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: plan,
			dateLabel: "20. September",
			durationMinutes: 10,
			goal: "Test",
			tasks: [],
			expectedOutcome: "Test",
			createdAt: now,
			updatedAt: now,
		};
		const dateKey = normalizeDates ? "2026-09-20" : "2026-09-20T00:00:00.000Z";
		const check = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "practice",
			sessionPurpose: "diagnostic",
			title: "Wissenscheck",
			dateKey,
			startTime: "10:00",
			sortOrder: 0,
			planningStatus: "committed",
			executionStatus: "completed",
			completed: true,
		});
		const theory = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "theory",
			title: "Brutto aus Netto berechnen",
			dateKey,
			startTime: "10:10",
			sortOrder: 1,
			planningStatus: "committed",
			executionStatus: "notStarted",
		});
		const practice = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "practice",
			title: "Brutto aus Netto berechnen",
			dateKey: "2026-09-20",
			startTime: "10:20",
			sortOrder: 2,
			planningStatus: commitPractice ? "committed" : "provisional",
			executionStatus: "notStarted",
		});
		return { plan, theory, practice, check };
	});
	return { t, ...ids };
}

async function expectNextSession(
	{ t, plan }: Awaited<ReturnType<typeof fixture>>,
	todayKey: string,
	expected: Id<"learningPlanSessions"> | null,
) {
	const analysis = await t.query(api.userAnalytics.getExamAnalysis, {
		learningPlanId: plan,
		todayKey,
	});
	const overview = await t.query(api.userAnalytics.getOverview, {
		period: "all",
		todayKey,
		// Deliberately fixed: the current activity offset must not determine
		// the calendar day of a session scheduled on the other side of DST.
		timezoneOffsetMinutes: -120,
	});
	expect(analysis.recommendation?.sessionId ?? null).toBe(expected);
	expect(analysis.preparation.nextSession?.id ?? null).toBe(expected);
	expect(overview.nextSession?.id ?? null).toBe(expected);
}

for (const todayKey of ["2026-09-15", "2026-09-20", "2026-09-25"]) {
	test(`completed check recommends loadable theory with mixed dates on ${todayKey}`, async () => {
		const { t, plan, theory, check } = await fixture();
		const before = await t.run((ctx) =>
			ctx.db.get("learningPlanSessions", check),
		);
		const analysis = await t.query(api.userAnalytics.getExamAnalysis, {
			learningPlanId: plan,
			todayKey,
		});
		expect(analysis.recommendation?.sessionId).toBe(theory);
		if (!analysis.recommendation)
			throw new Error("Expected a next learning step");
		await expect(
			t.query(api.learningSessionContent.getSessionContent, {
				sessionId: analysis.recommendation.sessionId,
			}),
		).resolves.toMatchObject({ session: { id: theory } });
		const overview = await t.query(api.userAnalytics.getOverview, {
			period: "all",
			todayKey,
			timezoneOffsetMinutes: 0,
		});
		expect(overview.nextSession?.id).toBe(theory);
		expect(
			await t.run((ctx) => ctx.db.get("learningPlanSessions", check)),
		).toEqual(before);
	});
}

test("committed sessions retain chronological order across legacy and date-only keys", async () => {
	const { t, plan, theory } = await fixture(false, true);
	const a = await t.query(api.userAnalytics.getExamAnalysis, {
		learningPlanId: plan,
		todayKey: "2026-09-15",
	});
	expect(a.recommendation?.sessionId).toBe(theory);
});

test("all-overdue committed sessions resume the earliest unfinished block", async () => {
	const { t, plan, theory } = await fixture(true, true);
	const a = await t.query(api.userAnalytics.getExamAnalysis, {
		learningPlanId: plan,
		todayKey: "2026-09-25",
	});
	expect(a.recommendation?.sessionId).toBe(theory);
});

const editedDates = [
	{ day: "2026-01-01", stored: "2025-12-31T23:00:00.000Z" },
	{ day: "2026-09-20", stored: "2026-09-19T22:00:00.000Z" },
	{ day: "2026-03-29", stored: "2026-03-28T23:00:00.000Z" },
	{ day: "2026-03-30", stored: "2026-03-29T22:00:00.000Z" },
	{ day: "2026-10-25", stored: "2026-10-24T22:00:00.000Z" },
	{ day: "2026-10-26", stored: "2026-10-25T23:00:00.000Z" },
];

test.each(
	editedDates,
)("an edited session stored as $stored is eligible on $day", async ({
	day,
	stored,
}) => {
	const data = await fixture(false, true);
	const { t, theory, practice } = data;
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", practice, { dateKey: day }),
	);
	// Exercise the editor's actual save mutation with its legacy ISO payload.
	await t.mutation(api.learningPlans.updateSession, {
		id: theory,
		phase: "theory",
		dateKey: stored,
		dateLabel: day,
		startTime: "10:10",
		durationMinutes: 10,
	});
	await expectNextSession(data, day, theory);
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId: theory,
	});
	expect(content.session.id).toBe(theory);
	// Reading a recommendation does not rewrite the stored date format.
	expect(
		(await t.run((ctx) => ctx.db.get("learningPlanSessions", theory)))?.dateKey,
	).toBe(stored);
});

test.each(
	editedDates,
)("same-day clock times order edited $stored alongside date-only sessions", async ({
	day,
	stored,
}) => {
	const data = await fixture(false, true);
	const { t, theory, practice } = data;
	await t.run(async (ctx) => {
		await ctx.db.patch("learningPlanSessions", theory, {
			dateKey: stored,
			startTime: "10:30",
		});
		await ctx.db.patch("learningPlanSessions", practice, { dateKey: day });
	});
	// Check both upcoming and all-overdue selection; UTC date ordering
	// would incorrectly put the later edited session first in both cases.
	await expectNextSession(data, "2025-12-30", practice);
	await expectNextSession(data, "2026-12-31", practice);
});

test("equivalent ISO offsets and date-only keys use sortOrder when clock times tie", async () => {
	const data = await fixture(false, true);
	await data.t.run(async (ctx) => {
		await ctx.db.patch("learningPlanSessions", data.theory, {
			dateKey: "2026-09-20T00:00:00+02:00",
		});
		await ctx.db.patch("learningPlanSessions", data.practice, {
			startTime: "10:10",
		});
	});
	await expectNextSession(data, "2026-09-20", data.theory);
});

test("an unreadable legacy date cannot break recommendations", async () => {
	const data = await fixture(false, true);
	await data.t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", data.theory, {
			dateKey: "invalid-date",
		}),
	);
	await expectNextSession(data, "2026-09-20", data.practice);
});

for (const unavailable of ["completed", "adjusted", "deleted"] as const) {
	test(`only a preview remains after the committed session is ${unavailable}`, async () => {
		const { t, plan, theory, practice } = await fixture();
		await t.run(async (ctx) => {
			if (unavailable === "deleted")
				await ctx.db.delete("learningPlanSessions", theory);
			else
				await ctx.db.patch("learningPlanSessions", theory, {
					executionStatus: unavailable,
					completed: unavailable === "completed",
				});
		});
		const a = await t.query(api.userAnalytics.getExamAnalysis, {
			learningPlanId: plan,
			todayKey: "2026-09-15",
		});
		expect(a.recommendation).toBeNull();
		expect(a.preparation.nextSession).toBeNull();
		const overview = await t.query(api.userAnalytics.getOverview, {
			period: "all",
			todayKey: "2026-09-15",
			timezoneOffsetMinutes: 0,
		});
		expect(overview.nextSession).toBeNull();
		await expect(
			t.query(api.learningSessionContent.getSessionContent, {
				sessionId: practice,
			}),
		).rejects.toThrow("nur eine Vorschau");
	});
}

test("legacy sessions without planningStatus remain eligible", async () => {
	const { t, plan, theory } = await fixture();
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", theory, { planningStatus: undefined }),
	);
	const a = await t.query(api.userAnalytics.getExamAnalysis, {
		learningPlanId: plan,
		todayKey: "2026-09-15",
	});
	expect(a.recommendation?.sessionId).toBe(theory);
});

for (const contentGenerationStatus of ["generating", "ready"] as const) {
	test(`recommendation remains loadable while content is ${contentGenerationStatus}`, async () => {
		const { t, plan, theory } = await fixture();
		await t.run(async (ctx) => {
			await ctx.db.patch("learningPlanSessions", theory, {
				contentGenerationStatus,
			});
			if (contentGenerationStatus === "ready") {
				await ctx.db.insert("learningSessionContentItems", {
					ownerTokenIdentifier: identity.tokenIdentifier,
					learningPlanId: plan,
					sessionId: theory,
					phase: "theory",
					kind: "learnCard",
					title: "Brutto aus Netto",
					prompt: "Wie berechnest du den Bruttopreis?",
					front: "Nettopreis",
					back: "Nettopreis mal 1,19",
					idealAnswer: "Nettopreis mal 1,19",
					evaluationKeywords: [],
					explanation: "Bei 19 Prozent Umsatzsteuer: Nettopreis mal 1,19.",
					sortOrder: 0,
					createdAt: 1,
					updatedAt: 1,
				});
			}
		});
		const analysis = await t.query(api.userAnalytics.getExamAnalysis, {
			learningPlanId: plan,
			todayKey: "2026-09-15",
		});
		if (!analysis.recommendation)
			throw new Error("Expected a next learning step");
		const content = await t.query(
			api.learningSessionContent.getSessionContent,
			{ sessionId: analysis.recommendation.sessionId },
		);
		expect(content.session.id).toBe(theory);
		expect(content.session.contentGenerationStatus).toBe(
			contentGenerationStatus,
		);
		expect(content.items).toHaveLength(
			contentGenerationStatus === "ready" ? 1 : 0,
		);
	});
}
