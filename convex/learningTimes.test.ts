/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

test("allows multiple learning times on the same weekday", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const firstId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "16:00",
		endTime: "17:00",
	});
	const secondId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "18:00",
		endTime: "19:00",
	});

	expect(firstId).not.toBe(secondId);
	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([
		{
			id: firstId,
			dayOfWeek: 1,
			startTime: "16:00",
			endTime: "17:00",
		},
		{
			id: secondId,
			dayOfWeek: 1,
			startTime: "18:00",
			endTime: "19:00",
		},
	]);
});

test("updates only the selected learning time", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const firstId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "16:00",
		endTime: "17:00",
	});
	const secondId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "18:00",
		endTime: "19:00",
	});

	await t.mutation(api.learningTimes.upsertMine, {
		id: firstId,
		dayOfWeek: 3,
		startTime: "15:30",
		endTime: "16:30",
	});

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([
		{
			id: secondId,
			dayOfWeek: 2,
			startTime: "18:00",
			endTime: "19:00",
		},
		{
			id: firstId,
			dayOfWeek: 3,
			startTime: "15:30",
			endTime: "16:30",
		},
	]);
});

test("removes only the selected learning time", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	const firstId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 4,
		startTime: "16:00",
		endTime: "17:00",
	});
	const secondId = await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 4,
		startTime: "18:00",
		endTime: "19:00",
	});

	await t.mutation(api.learningTimes.removeMine, { id: firstId });

	await expect(t.query(api.learningTimes.listMine, {})).resolves.toEqual([
		{
			id: secondId,
			dayOfWeek: 4,
			startTime: "18:00",
			endTime: "19:00",
		},
	]);
});

test("rejects overlapping learning times on the same weekday", async () => {
	const t = convexTest(schema, modules).withIdentity(user);

	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 5,
		startTime: "16:00",
		endTime: "17:00",
	});

	await expect(
		t.mutation(api.learningTimes.upsertMine, {
			dayOfWeek: 5,
			startTime: "16:30",
			endTime: "17:30",
		}),
	).rejects.toThrow("überschneidet");
});

test("creates visible proposed defaults without treating them as confirmed preferences", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			tokenIdentifier: user.tokenIdentifier,
			clerkId: "clerk_defaults",
			email: "defaults@example.de",
			grade: "11",
		});
	});
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2027-01-30",
		title: "Mathe Klausur",
		kind: "Leistungskontrolle",
		plannedDateLabel: "30. Januar 2027",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});
	const learningPlanId = await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2027-01-30",
		examDateLabel: "30. Januar 2027",
		durationMinutes: 90,
		topicDescription: "Lineare Funktionen",
	});

	const proposed = await t.mutation(api.learningTimes.prepareDefaultsForPlan, {
		learningPlanId,
	});
	expect(proposed.length).toBeGreaterThan(0);
	expect(
		proposed.every((entry) => entry.preferenceStatus === "systemDefault"),
	).toBe(true);
	expect(proposed.every((entry) => entry.startTime === "16:00")).toBe(true);
	expect(proposed.every((entry) => entry.endTime === "00:00")).toBe(true);
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.plan.learningTimeSuggestion?.entries.length).toBe(
		proposed.length,
	);

	await t.mutation(api.learningTimes.confirmProposedDefaults, {
		learningPlanId,
	});
	const confirmed = await t.query(api.learningTimes.listMine, {});
	expect(confirmed.every((entry) => !("preferenceStatus" in entry))).toBe(true);
	const confirmedSnapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(confirmedSnapshot?.plan.learningTimeSuggestion).toBeUndefined();
});

test("reschedules only future sessions after a learning-time change", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const { learningPlanId, completedSessionId, futureSessionId } = await t.run(
		async (ctx) => {
			const now = Date.now();
			const learningPlanId = await ctx.db.insert("learningPlans", {
				ownerTokenIdentifier: user.tokenIdentifier,
				subject: "Mathe",
				examTypeLabel: "Klausur",
				examDateKey: "2099-01-30",
				examDateLabel: "30. Januar 2099",
				durationMinutes: 90,
				topicDescription: "Lineare Funktionen",
				status: "accepted",
				rollingPlanEnabled: true,
				createdAt: now,
				updatedAt: now,
			});
			const completedSessionId = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: user.tokenIdentifier,
				learningPlanId,
				phase: "practice",
				title: "Abgeschlossen",
				dateKey: "2026-01-05",
				dateLabel: "5. Januar 2026",
				startTime: "16:00",
				durationMinutes: 30,
				sessionPurpose: "learning",
				goal: "Bereits erledigt.",
				tasks: ["Aufgabe lösen"],
				expectedOutcome: "Erledigt.",
				completed: true,
				executionStatus: "completed",
				planningStatus: "committed",
				sortOrder: 0,
				createdAt: now,
				updatedAt: now,
			});
			const futureSessionId = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: user.tokenIdentifier,
				learningPlanId,
				phase: "practice",
				title: "Als Nächstes",
				dateKey: "2098-12-01",
				dateLabel: "1. Dezember 2098",
				startTime: "17:00",
				durationMinutes: 30,
				sessionPurpose: "learning",
				goal: "Als Nächstes üben.",
				tasks: ["Aufgabe lösen"],
				expectedOutcome: "Sicherer werden.",
				executionStatus: "notStarted",
				planningStatus: "committed",
				sortOrder: 1,
				createdAt: now,
				updatedAt: now,
			});
			return { learningPlanId, completedSessionId, futureSessionId };
		},
	);

	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "18:00",
		endTime: "18:30",
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const completed = snapshot?.sessions.find(
		(session) => session.id === completedSessionId,
	);
	const future = snapshot?.sessions.find(
		(session) => session.id === futureSessionId,
	);
	expect(completed).toMatchObject({
		dateKey: "2026-01-05",
		startTime: "16:00",
		executionStatus: "completed",
	});
	expect(future?.startTime).toBe("18:00");
	expect(
		new Date(`${future?.dateKey.slice(0, 10)}T12:00:00Z`).getUTCDay(),
	).toBe(1);
});

test("offers and applies a consent-based behavioral learning-time suggestion", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await t.run(async (ctx) => {
		const now = Date.now();
		await ctx.db.insert("users", {
			tokenIdentifier: user.tokenIdentifier,
			clerkId: "clerk_behavior",
			email: "behavior@example.de",
			grade: "9",
		});
		for (const dayOfWeek of [1, 2]) {
			await ctx.db.insert("userLearningTimes", {
				ownerTokenIdentifier: user.tokenIdentifier,
				dayOfWeek,
				startTime: "17:00",
				endTime: "18:00",
				preferenceStatus: "confirmed",
				createdAt: now,
				updatedAt: now,
			});
		}
		const learningPlanId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: user.tokenIdentifier,
			subject: "Mathe",
			examTypeLabel: "Klausur",
			examDateKey: "2099-01-30",
			examDateLabel: "30. Januar 2099",
			durationMinutes: 90,
			topicDescription: "Lineare Funktionen",
			status: "accepted",
			rollingPlanEnabled: true,
			createdAt: now,
			updatedAt: now,
		});
		const observations = [
			["2026-06-01", "2026-06-01T18:00:00.000Z"],
			["2026-06-02", "2026-06-02T18:10:00.000Z"],
			["2026-06-08", "2026-06-08T17:50:00.000Z"],
			["2026-06-09", "2026-06-09T18:00:00.000Z"],
			["2026-06-15", "2026-06-15T18:05:00.000Z"],
		] as const;
		for (const [index, [dateKey, startedAt]] of observations.entries()) {
			await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: user.tokenIdentifier,
				learningPlanId,
				phase: "practice",
				title: `Lernsession ${index + 1}`,
				dateKey,
				dateLabel: dateKey,
				startTime: "17:00",
				durationMinutes: 60,
				sessionPurpose: "learning",
				goal: "Üben",
				tasks: ["Aufgabe lösen"],
				expectedOutcome: "Sicherer werden",
				completed: true,
				executionStatus: "completed",
				startedAt: new Date(startedAt).getTime(),
				outcomeAt: new Date(startedAt).getTime() + 60 * 60_000,
				planningStatus: "committed",
				sortOrder: index,
				createdAt: now + index,
				updatedAt: now + index,
			});
		}
		return learningPlanId;
	});

	const before = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const suggestion = before?.plan.behavioralLearningTimeSuggestion;
	expect(suggestion).toMatchObject({
		plannedStartTime: "17:00",
		observedStartTime: "20:00",
	});
	if (!suggestion) throw new Error("Expected a behavioral suggestion.");

	await t.mutation(api.learningTimes.applyBehavioralSuggestion, {
		fingerprint: suggestion.fingerprint,
	});
	expect(await t.query(api.learningTimes.listMine, {})).toEqual([
		expect.objectContaining({
			dayOfWeek: 1,
			startTime: "20:00",
			endTime: "21:00",
		}),
		expect.objectContaining({
			dayOfWeek: 2,
			startTime: "20:00",
			endTime: "21:00",
		}),
	]);
	const after = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(after?.plan.behavioralLearningTimeSuggestion).toBeUndefined();
	expect(
		after?.sessions.every((session) => session.executionStatus === "completed"),
	).toBe(true);
});
