/// <reference types="vite/client" />
import { register } from "@gilhrpenner/convex-files-control/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { materialReplacementContext } from "./learningPlanAi";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const identity = { tokenIdentifier: "test:material-owner" };
const topic = {
	id: "gleichungen",
	title: "Gleichungen",
	learningGoal: "Lineare Gleichungen sicher lösen",
	keywords: ["Gleichung"],
	priority: "high" as const,
};
const newItem = {
	phase: "practice" as const,
	kind: "written" as const,
	title: "Neue Aufgabe",
	prompt: "Löse 3x = 12.",
	explanation: "Teile beide Seiten durch drei.",
	idealAnswer: "x = 4",
	evaluationKeywords: ["4"],
};

async function setup() {
	const root = convexTest(schema, modules);
	register(root);
	const t = root.withIdentity(identity);
	const ids = await t.run(async (ctx) => {
		const planId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			subject: "Mathematik",
			examTypeLabel: "Klausur",
			examDateKey: "2026-12-01",
			examDateLabel: "1. Dezember",
			durationMinutes: 60,
			topicDescription: "Lineare Gleichungen",
			status: "accepted",
			topicMap: [topic],
			topicReadiness: [{ topicId: topic.id, status: "secure" }],
			materialRevision: 1,
			acceptedAt: 1,
			createdAt: 1,
			updatedAt: 1,
		});
		const sessions = [];
		for (let index = 0; index < 3; index++) {
			const id = await ctx.db.insert("learningPlanSessions", {
				ownerTokenIdentifier: identity.tokenIdentifier,
				learningPlanId: planId,
				phase: "practice",
				title: "Gleichungen üben",
				dateKey: "2026-11-01",
				dateLabel: "1. November",
				startTime: "16:00",
				durationMinutes: 10,
				goal: "Gleichungen lösen",
				tasks: ["Gleichungen üben"],
				expectedOutcome: "Sicher lösen",
				sortOrder: index,
				executionStatus: index === 2 ? "completed" : "notStarted",
				completed: index === 2,
				contentGenerationStatus: "ready",
				createdAt: 1,
				updatedAt: 1,
			});
			await ctx.db.insert("learningSessionContentItems", {
				...newItem,
				title: "Alte Aufgabe",
				prompt: `Löse x + ${index + 1} = 2.`,
				ownerTokenIdentifier: identity.tokenIdentifier,
				learningPlanId: planId,
				sessionId: id,
				sortOrder: 0,
				createdAt: 1,
				updatedAt: 1,
			});
			sessions.push(id);
		}
		return { planId, sessions };
	});
	const claim = await t.mutation(internal.learningPlanMaterialUpdates.claim, {
		learningPlanId: ids.planId,
		updateId: "update-1",
	});
	const replacements = await Promise.all(
		claim.sessionIds.map(async (sessionId) => {
			const context = await t.query(
				internal.learningSessionContent.getSessionGenerationContext,
				{ sessionId },
			);
			return {
				sessionId,
				expectedSession: JSON.stringify(context.session),
				expectedContent: context.expectedContent,
				items: [newItem],
			};
		}),
	);
	const finish = {
		learningPlanId: ids.planId,
		updateId: "update-1",
		revision: claim.revision,
		sourceSummary: "Aktuelles Schulmaterial zu linearen Gleichungen.",
		topics: [topic],
		additionalMinutes: 20,
		sessions: replacements,
	};
	const read = () =>
		t.run(async (ctx) => ({
			plan: await ctx.db.get("learningPlans", ids.planId),
			sessions: await Promise.all(
				ids.sessions.map((id) => ctx.db.get("learningPlanSessions", id)),
			),
			items: await ctx.db.query("learningSessionContentItems").take(100),
			attempts: await ctx.db.query("learningSessionAnswerAttempts").take(100),
		}));
	return { root, t, ...ids, claim, finish, read };
}

test("updates only untouched blocks and preserves completed content, readiness and schedules", async () => {
	const { t, finish, read, sessions } = await setup();
	const before = await read();
	expect(finish.sessions.map((s) => s.sessionId)).toEqual(sessions.slice(0, 2));
	expect(
		await t.mutation(internal.learningPlanMaterialUpdates.finish, finish),
	).toMatchObject({ updatedSessionCount: 2, additionalMinutes: 20 });
	const after = await read();
	expect(after.plan?.appliedMaterialRevision).toBe(1);
	expect(after.plan?.topicReadiness).toEqual(before.plan?.topicReadiness);
	for (let i = 0; i < sessions.length; i++) {
		expect(after.sessions[i]).toMatchObject({
			dateKey: before.sessions[i]?.dateKey,
			startTime: before.sessions[i]?.startTime,
			durationMinutes: before.sessions[i]?.durationMinutes,
		});
	}
	expect(after.sessions[2]).toEqual(before.sessions[2]);
	expect(after.items.filter((i) => i.sessionId === sessions[2])).toEqual(
		before.items.filter((i) => i.sessionId === sessions[2]),
	);
	expect(
		after.items.filter((i) => i.sessionId === sessions[0]).map((i) => i.prompt),
	).toContain(newItem.prompt);
});

test("concurrent uploads invalidate the entire update without replacing any content", async () => {
	const { t, finish, read, planId } = await setup();
	await t.mutation(internal.learningPlans.storeUploadedDocument, {
		ownerTokenIdentifier: identity.tokenIdentifier,
		learningPlanId: planId,
		storageId: "new-upload",
		storageProvider: "convex",
		fileName: "neues.pdf",
		fileType: "application/pdf",
		fileSizeBytes: 100,
		sourceKind: "school",
	});
	const before = await read();
	expect(before.plan?.materialRevision).toBe(2);
	await expect(
		t.mutation(internal.learningPlanMaterialUpdates.finish, finish),
	).rejects.toThrow(/zwischenzeitlich geändert/);
	expect(await read()).toEqual(before);
});

test("starting a block during generation preserves its content and progress", async () => {
	const { t, finish, read, sessions } = await setup();
	await t.run(async (ctx) => {
		await ctx.db.patch("learningPlanSessions", sessions[0], {
			executionStatus: "started",
			startedAt: 5,
		});
	});
	const before = await read();
	await expect(
		t.mutation(internal.learningPlanMaterialUpdates.finish, finish),
	).rejects.toThrow(/inzwischen begonnen/);
	const after = await read();
	expect(after.sessions[0]).toEqual(before.sessions[0]);
	expect(after.items.filter((i) => i.sessionId === sessions[0])).toEqual(
		before.items.filter((i) => i.sessionId === sessions[0]),
	);
});

test("a schedule change in the second block rolls back replacements for the first too", async () => {
	const { t, finish, read, sessions } = await setup();
	await t.run(async (ctx) => {
		await ctx.db.patch("learningPlanSessions", sessions[1], {
			startTime: "18:00",
		});
	});
	const before = await read();
	await expect(
		t.mutation(internal.learningPlanMaterialUpdates.finish, finish),
	).rejects.toThrow(/zwischenzeitlich geändert/);
	expect(await read()).toEqual(before);
});

test("failed generation keeps existing content and pending revision, then permits retry", async () => {
	const { t, planId, read } = await setup();
	const before = await read();
	await t.mutation(internal.learningPlanMaterialUpdates.fail, {
		learningPlanId: planId,
		updateId: "update-1",
	});
	const after = await read();
	expect(after.items).toEqual(before.items);
	expect(after.sessions).toEqual(before.sessions);
	expect(after.plan?.appliedMaterialRevision).toBeUndefined();
	expect(after.plan?.materialUpdateError).toContain("bleiben erhalten");
	await expect(
		t.mutation(internal.learningPlanMaterialUpdates.claim, {
			learningPlanId: planId,
			updateId: "retry",
		}),
	).resolves.toMatchObject({ revision: 1 });
});

test("duplicate updates and another user's access are rejected", async () => {
	const { root, t, planId, finish } = await setup();
	await expect(
		t.mutation(internal.learningPlanMaterialUpdates.claim, {
			learningPlanId: planId,
			updateId: "duplicate",
		}),
	).rejects.toThrow(/bereits/);
	const other = root.withIdentity({ tokenIdentifier: "test:other" });
	await expect(
		other.mutation(internal.learningPlanMaterialUpdates.finish, finish),
	).rejects.toThrow(/nicht gefunden/);
	await expect(
		other.mutation(internal.learningPlanMaterialUpdates.claim, {
			learningPlanId: planId,
			updateId: "other",
		}),
	).rejects.toThrow(/nicht gefunden/);
});

test("legacy progress without started status is preserved", async () => {
	const { t, read, finish, sessions, planId } = await setup();
	const before = await read();
	await t.run(async (ctx) => {
		const item = before.items.find((i) => i.sessionId === sessions[0]);
		if (!item) throw new Error("Expected original item");
		await ctx.db.insert("learningSessionAnswerAttempts", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: planId,
			sessionId: sessions[0],
			itemId: item._id,
			answerText: "1",
			rating: "correct",
			feedback: "Richtig",
			perfectAnswer: "1",
			createdAt: 2,
		});
	});
	const progress = await read();
	await expect(
		t.mutation(internal.learningPlanMaterialUpdates.finish, finish),
	).rejects.toThrow(/inzwischen begonnen/);
	const after = await read();
	expect(after.attempts).toEqual(progress.attempts);
	expect(after.items.filter((i) => i.sessionId === sessions[0])).toEqual(
		progress.items.filter((i) => i.sessionId === sessions[0]),
	);
});

test("replacement contexts exclude old predecessors and use the staged new coverage", async () => {
	const { t, sessions } = await setup();
	const context = await t.query(
		internal.learningSessionContent.getSessionGenerationContext,
		{ sessionId: sessions[1], excludePriorSessionIds: sessions.slice(0, 2) },
	);
	expect(context.priorSessionItems.map((i) => i.prompt)).not.toContain(
		"Löse x + 1 = 2.",
	);
	const fractions = {
		...topic,
		id: "brueche",
		title: "Brüche",
		learningGoal: "Brüche sicher addieren",
	};
	const prepared = {
		...newItem,
		learningBlockIndex: 0,
		questionAngle: "understanding",
		estimatedSeconds: 40,
		topicId: fractions.id,
		coverageKey: "brueche:new:understanding",
	};
	const replacement = materialReplacementContext(
		context,
		[topic, fractions],
		"Aktuell: Gleichungen und Brüche",
		[prepared],
	);
	expect(replacement.session.targetTopicIds).toEqual([topic.id, fractions.id]);
	expect(replacement.priorSessionItems).toContainEqual({
		prompt: newItem.prompt,
		coverageKey: prepared.coverageKey,
	});
	expect(replacement.priorCoverageKeys).toContain(prepared.coverageKey);
	expect(replacement.plan.sourceSummary).toBe(
		"Aktuell: Gleichungen und Brüche",
	);
});

test("uncovered new topics remain visible as a request for an additional learning block", async () => {
	const { t, finish, read } = await setup();
	const fractions = { ...topic, id: "brueche", title: "Brüche" };
	await t.mutation(internal.learningPlanMaterialUpdates.finish, {
		...finish,
		topics: [topic, fractions],
	});
	expect((await read()).plan?.materialUncoveredTopics).toEqual(["Brüche"]);
});

test("removing an uploaded document marks the accepted plan pending without deleting learning content", async () => {
	const { t, planId, read } = await setup();
	const documentId = await t.run(async (ctx) => {
		const storageId = await ctx.storage.store(new Blob(["Material"]));
		return await ctx.db.insert("learningPlanDocuments", {
			ownerTokenIdentifier: identity.tokenIdentifier,
			learningPlanId: planId,
			storageId,
			storageProvider: "convex",
			fileName: "mathe.pdf",
			fileType: "application/pdf",
			fileSizeBytes: 8,
			sourceKind: "school",
			createdAt: 1,
		});
	});
	const before = await read();
	await t.mutation(api.learningPlans.removeDocument, { id: documentId });
	const after = await read();
	expect(after.plan?.materialRevision).toBe(2);
	expect(after.items).toEqual(before.items);
	expect(after.sessions).toEqual(before.sessions);
});
