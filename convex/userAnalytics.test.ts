/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { tokenIdentifier: "test:analytics-user" };

const seedAnalyticsData = async () => {
	const backend = convexTest(schema, modules);
	const t = backend.withIdentity(identity);
	const learningPlanId = await t.run(async (ctx) => {
		const now = Date.UTC(2026, 6, 28, 12);
		return await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			subject: "Mathe",
			examTypeLabel: "Klausur",
			examDateKey: "2026-08-05",
			examDateLabel: "5. August 2026",
			durationMinutes: 90,
			topicDescription: "Lineare Funktionen",
			status: "accepted",
			createdAt: now,
			updatedAt: now,
		});
	});
	const ids = await t.run(async (ctx) => {
		const base = {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId,
			dateLabel: "28. Juli 2026",
			startTime: "16:00",
			durationMinutes: 30,
			goal: "Sicher anwenden.",
			tasks: ["Aufgaben lösen"],
			expectedOutcome: "Du kannst die Aufgabe lösen.",
			createdAt: Date.UTC(2026, 6, 27, 10),
			updatedAt: Date.UTC(2026, 6, 28, 14),
		};
		const firstSessionId = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "practice",
			title: "Gleichungen üben",
			dateKey: "2026-07-27",
			completed: true,
			executionStatus: "completed",
			outcomeAt: Date.UTC(2026, 6, 27, 14),
			activeStudySeconds: 1_200,
			sortOrder: 0,
		});
		const missedSessionId = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "theory",
			title: "Grundlagen wiederholen",
			dateKey: "2026-07-27",
			completed: false,
			executionStatus: "adjusted",
			outcomeAt: Date.UTC(2026, 6, 27, 15),
			sortOrder: 1,
		});
		const recoverySessionId = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "theory",
			title: "Kleiner Neustart",
			dateKey: "2026-07-28",
			completed: true,
			executionStatus: "completed",
			outcomeAt: Date.UTC(2026, 6, 28, 14),
			activeStudySeconds: 600,
			adjustedFromSessionId: missedSessionId,
			sortOrder: 2,
		});
		const openSessionId = await ctx.db.insert("learningPlanSessions", {
			...base,
			phase: "rehearsal",
			title: "Generalprobe",
			dateKey: "2026-07-30",
			completed: false,
			executionStatus: "notStarted",
			sortOrder: 3,
		});
		const itemId = await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId,
			sessionId: recoverySessionId,
			phase: "theory",
			kind: "written",
			title: "Steigung",
			prompt: "Erkläre die Steigung.",
			explanation: "Die Steigung beschreibt die Änderung.",
			idealAnswer: "Änderung von y pro Änderung von x.",
			evaluationKeywords: ["Änderung"],
			sortOrder: 0,
			createdAt: Date.UTC(2026, 6, 28, 13),
			updatedAt: Date.UTC(2026, 6, 28, 13),
		});
		await ctx.db.insert("learningSessionAnswerAttempts", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId,
			sessionId: recoverySessionId,
			itemId,
			answerText: "Änderung von y.",
			rating: "partiallyCorrect",
			feedback:
				"Du nennst die Änderung von y, aber die Änderung von x fehlt noch.",
			perfectAnswer: "Änderung von y pro Änderung von x.",
			timeSpentSeconds: 45,
			createdAt: Date.UTC(2026, 6, 28, 13, 30),
		});
		await ctx.db.insert("learningSessionAnalyses", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId,
			sessionId: recoverySessionId,
			strengths: ["Du erkennst lineare Zusammenhänge."],
			gaps: ["Steigung noch präziser erklären."],
			recommendation: "Übe eine weitere Steigungsaufgabe.",
			createdAt: Date.UTC(2026, 6, 28, 14),
			updatedAt: Date.UTC(2026, 6, 28, 14),
		});
		return { firstSessionId, recoverySessionId, openSessionId };
	});
	return { backend, t, learningPlanId, ...ids };
};

test("returns private, actionable learning analytics for the selected period", async () => {
	const { t, learningPlanId, openSessionId } = await seedAnalyticsData();

	const overview = await t.query(api.userAnalytics.getOverview, {
		period: "week",
		todayKey: "2026-07-28",
		timezoneOffsetMinutes: 0,
	});

	expect(overview.overall).toEqual({
		acceptedPlans: 1,
		finishedPlans: 0,
		completedSessions: 2,
		totalSessions: 3,
		progressPercent: 67,
	});
	expect(overview.period).toEqual({
		completedSessions: 2,
		activeStudyMinutes: 30,
		recoveredSessions: 1,
	});
	expect(overview.currentStreakDays).toBe(2);
	expect(overview.nextSession).toMatchObject({
		id: openSessionId,
		learningPlanId,
		subject: "Mathe",
		title: "Generalprobe",
	});
	expect(overview.knowledge).toMatchObject({
		answeredItems: 1,
		correct: 0,
		partiallyCorrect: 1,
		notCorrect: 0,
		scorePercent: 50,
		strengths: ["Du erkennst lineare Zusammenhänge."],
		gaps: ["Steigung noch präziser erklären."],
		recommendation: "Übe eine weitere Steigungsaufgabe.",
	});
	expect(overview.activity.at(-1)).toEqual({
		dayKey: "2026-07-28",
		completedSessions: 1,
		activeStudyMinutes: 10,
	});
});

test("returns a selected exam analysis grounded in topics, answers, and scheduled work", async () => {
	const { t, learningPlanId, openSessionId } = await seedAnalyticsData();
	await t.run(async (ctx) => {
		await ctx.db.patch("learningPlans", learningPlanId, {
			targetStudyMinutes: 90,
			topicMap: [
				{
					id: "steigung",
					title: "Steigung erklären",
					learningGoal: "Du kannst die Steigung vollständig erklären.",
					keywords: ["Steigung", "Änderung"],
					priority: "high",
				},
				{
					id: "achsenschnitt",
					title: "Achsenschnittpunkte bestimmen",
					learningGoal: "Du kannst Achsenschnittpunkte sicher bestimmen.",
					keywords: ["Achse", "Schnittpunkt"],
					priority: "medium",
				},
			],
			topicReadiness: [
				{ topicId: "steigung", status: "developing" },
				{ topicId: "achsenschnitt", status: "secure" },
			],
		});
		const recoveryItem = await ctx.db
			.query("learningSessionContentItems")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.first();
		if (!recoveryItem) throw new Error("Expected seeded content item");
		await ctx.db.patch("learningSessionContentItems", recoveryItem._id, {
			topicId: "steigung",
		});
		const sessionAnalysis = await ctx.db
			.query("learningSessionAnalyses")
			.withIndex("by_ownerTokenIdentifier", (q) =>
				q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
			)
			.first();
		if (!sessionAnalysis) throw new Error("Expected seeded session analysis");
		await ctx.db.patch("learningSessionAnalyses", sessionAnalysis._id, {
			strengths: [
				"Du erkennst lineare Zusammenhänge.",
				"Du hast erste Ansätze gezeigt und weißt, wo du ansetzen kannst.",
			],
		});
	});

	const analysis = await t.query(api.userAnalytics.getExamAnalysis, {
		learningPlanId,
		todayKey: "2026-07-28",
	});

	expect(analysis).toMatchObject({
		hasData: true,
		preliminary: false,
		selectedPlan: {
			id: learningPlanId,
			subject: "Mathe",
			examTypeLabel: "Klausur",
			examDateLabel: "5. August 2026",
			daysRemaining: 8,
		},
		readiness: {
			secure: 0,
			developing: 2,
			unknown: 0,
		},
		abilities: [
			{
				statement: "Du erkennst lineare Zusammenhänge.",
				evidenceCount: 1,
			},
		],
		primaryProblem: {
			diagnosisType: "applicationError",
			title: "Steigung",
			observation:
				"Du nennst die Änderung von y, aber die Änderung von x fehlt noch.",
			location: "Erkläre die Steigung.",
			explanation: "Die Steigung beschreibt die Änderung.",
			evidenceExcerpt: "Änderung von y.",
			evidenceCount: 1,
			evidenceLabel: "Einmal beobachtet",
			topicId: "steigung",
		},
		recommendation: {
			sessionId: openSessionId,
			title: "Generalprobe",
			goal: "Sicher anwenden.",
			methods: ["Aufgaben lösen"],
			durationMinutes: 30,
			verification: "Du kannst die Aufgabe lösen.",
		},
		preparation: {
			remainingDays: 8,
			remainingSessions: 1,
			remainingMinutes: 30,
			nextSession: {
				id: openSessionId,
				dateKey: "2026-07-30",
				startTime: "16:00",
				durationMinutes: 30,
			},
		},
	});
	expect(analysis.topics).toEqual([
		expect.objectContaining({
			id: "steigung",
			status: "developing",
			priority: "high",
		}),
		expect.objectContaining({
			id: "achsenschnitt",
			status: "developing",
			priority: "medium",
		}),
	]);
	await expect(
		t.query(api.userAnalytics.getExamAnalysis, {
			todayKey: "2026-07-28",
		}),
	).resolves.toMatchObject({
		selectedPlan: { id: learningPlanId },
	});
});

test("recommends a deferred theory check before the next open session", async () => {
	const { t, learningPlanId, recoverySessionId } = await seedAnalyticsData();
	await t.run(async (ctx) => {
		await ctx.db.patch("learningPlanSessions", recoverySessionId, {
			compositionVariant: "split",
			knowledgeValidationStatus: "skipped",
		});
	});

	const analysis = await t.query(api.userAnalytics.getExamAnalysis, {
		learningPlanId,
		todayKey: "2026-07-28",
	});

	expect(analysis).toMatchObject({
		reviewedNotVerified: true,
		latestKnowledgeChange:
			"Theorie abgeschlossen · Wissen noch nicht überprüft.",
		recommendation: {
			sessionId: recoverySessionId,
			title: "Wissenscheck",
			durationMinutes: 3,
			reason: "Theorie abgeschlossen · Wissen noch nicht überprüft.",
		},
	});
});

test("does not expose another learner's analytics", async () => {
	const { backend, learningPlanId } = await seedAnalyticsData();
	const otherUser = backend.withIdentity({
		tokenIdentifier: "test:other-user",
	});

	await expect(
		otherUser.query(api.userAnalytics.getOverview, {
			period: "all",
			todayKey: "2026-07-28",
			timezoneOffsetMinutes: 0,
		}),
	).resolves.toMatchObject({
		hasData: false,
		overall: {
			acceptedPlans: 0,
			completedSessions: 0,
			totalSessions: 0,
		},
	});
	await expect(
		otherUser.query(api.userAnalytics.getExamAnalysis, {
			todayKey: "2026-07-28",
		}),
	).resolves.toMatchObject({
		hasData: false,
		selectedPlan: null,
	});
	await expect(
		otherUser.query(api.userAnalytics.getExamAnalysis, {
			learningPlanId,
			todayKey: "2026-07-28",
		}),
	).rejects.toThrow("Lernplan nicht gefunden.");
});

test("keeps future outcomes out of the selected reporting period", async () => {
	const { t, learningPlanId } = await seedAnalyticsData();
	await t.run(async (ctx) => {
		await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId,
			phase: "practice",
			title: "Zukünftige Einheit",
			dateKey: "2026-07-30",
			dateLabel: "30. Juli 2026",
			startTime: "16:00",
			durationMinutes: 15,
			goal: "Später üben.",
			tasks: ["Aufgabe lösen"],
			expectedOutcome: "Du bist sicherer.",
			completed: true,
			executionStatus: "completed",
			outcomeAt: Date.UTC(2026, 6, 30, 14),
			activeStudySeconds: 900,
			sortOrder: 4,
			createdAt: Date.UTC(2026, 6, 30, 14),
			updatedAt: Date.UTC(2026, 6, 30, 14),
		});
	});

	const overview = await t.query(api.userAnalytics.getOverview, {
		period: "week",
		todayKey: "2026-07-28",
		timezoneOffsetMinutes: 0,
	});

	expect(overview.overall).toMatchObject({
		completedSessions: 3,
		totalSessions: 4,
	});
	expect(overview.period).toEqual({
		completedSessions: 2,
		activeStudyMinutes: 30,
		recoveredSessions: 1,
	});
});

test("rejects malformed calendar and timezone inputs", async () => {
	const t = convexTest(schema, modules).withIdentity(identity);

	await expect(
		t.query(api.userAnalytics.getOverview, {
			period: "week",
			todayKey: "2026-02-31",
			timezoneOffsetMinutes: 0,
		}),
	).rejects.toThrow("Ungültiger Kalendertag.");
	await expect(
		t.query(api.userAnalytics.getOverview, {
			period: "week",
			todayKey: "2026-07-28",
			timezoneOffsetMinutes: 841,
		}),
	).rejects.toThrow("Ungültige Zeitzone.");
});
