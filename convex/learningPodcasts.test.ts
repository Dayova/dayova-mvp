/// <reference types="vite/client" />
import workflow from "@convex-dev/workflow/test";
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { AI_CONSENT_VERSION } from "../src/lib/ai-consent";
import { api, internal } from "./_generated/api";
import {
	isPodcastSubject,
	type PodcastScript,
	validatePodcastScript,
} from "./podcastContent";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const script: PodcastScript = {
	turns: [
		{ speaker: "Mira", text: "Eine Metapher überträgt Bedeutung." },
		{ speaker: "Noah", text: "Wie erkenne ich sie?" },
		{ speaker: "Mira", text: "Sie verbindet zwei Bedeutungsbereiche." },
		{ speaker: "Noah", text: "Ich erkläre also das Bild im Kontext." },
	],
	questions: [0, 1].map((index) => ({
		prompt: `Frage ${index}`,
		options: ["Bedeutungsübertragung", "Reim", "Zeitform"],
		correctIndex: 0,
		explanation: "Eine Metapher überträgt Bedeutung.",
	})),
};

async function setup(subject = "Deutsch") {
	const t = convexTest(schema, modules);
	workflow.register(t);
	const ids = await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			tokenIdentifier: "owner",
			clerkId: "owner",
			email: "owner@example.test",
			aiConsentStatus: "granted",
			aiConsentVersion: AI_CONSENT_VERSION,
		});
		const planId = await ctx.db.insert("learningPlans", {
			ownerTokenIdentifier: "owner",
			subject,
			examTypeLabel: "Klausur",
			examDateKey: "2026-10-01",
			examDateLabel: "1. Oktober",
			durationMinutes: 60,
			topicDescription: "Metaphern",
			status: "accepted",
			createdAt: 1,
			updatedAt: 1,
		});
		const sessionId = await ctx.db.insert("learningPlanSessions", {
			ownerTokenIdentifier: "owner",
			learningPlanId: planId,
			phase: "theory",
			title: "Metaphern",
			dateKey: "2026-09-22",
			dateLabel: "Heute",
			startTime: "16:00",
			durationMinutes: 10,
			goal: "Metaphern erkennen",
			tasks: [],
			expectedOutcome: "Metaphern erklären",
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		});
		const itemId = await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: "owner",
			learningPlanId: planId,
			sessionId,
			phase: "theory",
			kind: "learnCard",
			title: "Metapher",
			prompt: "Was ist eine Metapher?",
			explanation: "Eine Metapher überträgt Bedeutung.",
			idealAnswer: "Bedeutungsübertragung",
			evaluationKeywords: [],
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		});
		const podcastId = await ctx.db.insert("learningPodcasts", {
			ownerTokenIdentifier: "owner",
			learningPlanId: planId,
			sessionId,
			fingerprint: JSON.stringify({
				subject,
				goal: "Metaphern erkennen",
				cards: [[itemId, 1]],
			}),
			status: "ready",
			attempt: 1,
			script,
			durationSeconds: 120,
			positionSeconds: 0,
			listened: false,
			answers: [],
			createdAt: 1,
			updatedAt: 1,
		});
		return { planId, sessionId, itemId, podcastId };
	});
	return { t, owner: t.withIdentity({ tokenIdentifier: "owner" }), ...ids };
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

test("language subjects include foreign languages and course suffixes", () => {
	for (const subject of [
		"Deutsch",
		"Englisch LK",
		"Französisch",
		"Spanisch",
		"Latein",
		"Altgriechisch",
		"Japanisch",
		"Türkisch",
		"Literatur",
	])
		expect(isPodcastSubject(subject)).toBe(true);
	for (const subject of ["Mathematik", "Physik", "Geschichte", "Informatik"])
		expect(isPodcastSubject(subject)).toBe(false);
});

test("rejects a one-voice script and invalid answer indices", () => {
	expect(() =>
		validatePodcastScript({
			...script,
			turns: script.turns.map((turn) => ({ ...turn, speaker: "Mira" })),
		}),
	).toThrow();
	expect(() =>
		validatePodcastScript({
			...script,
			questions: script.questions.map((q) => ({ ...q, correctIndex: 3 })),
		}),
	).toThrow();
});

test("reuses the episode for unchanged theory without new provider requests", async () => {
	const { owner, sessionId, podcastId } = await setup();
	expect(
		await owner.mutation(api.learningPodcasts.request, { sessionId }),
	).toBe(podcastId);
	expect(
		await owner.mutation(api.learningPodcasts.request, { sessionId }),
	).toBe(podcastId);
});

test("foreign users cannot read, generate, answer, or update listening progress", async () => {
	const { t, sessionId, podcastId } = await setup();
	const other = t.withIdentity({ tokenIdentifier: "other" });
	await expect(
		other.query(api.learningPodcasts.get, { sessionId }),
	).rejects.toThrow("nicht gefunden");
	await expect(
		other.mutation(api.learningPodcasts.request, { sessionId }),
	).rejects.toThrow("nicht gefunden");
	await expect(
		other.mutation(api.learningPodcasts.saveProgress, {
			podcastId,
			positionSeconds: 5,
		}),
	).rejects.toThrow("nicht gefunden");
	await expect(
		other.mutation(api.learningPodcasts.answer, {
			podcastId,
			questionIndex: 0,
			optionIndex: 0,
		}),
	).rejects.toThrow("nicht gefunden");
});

test("listening and comprehension feedback never complete a session or create mastery evidence", async () => {
	const { t, owner, sessionId, podcastId } = await setup();
	await owner.mutation(api.learningPodcasts.saveProgress, {
		podcastId,
		positionSeconds: 999,
	});
	await owner.mutation(api.learningPodcasts.answer, {
		podcastId,
		questionIndex: 0,
		optionIndex: 0,
	});
	const result = await owner.query(api.learningPodcasts.get, { sessionId });
	expect(result.episode).toMatchObject({
		positionSeconds: 120,
		listened: true,
		answers: [0, -1],
	});
	await t.run(async (ctx) => {
		expect(
			(await ctx.db.get("learningPlanSessions", sessionId))?.completed,
		).not.toBe(true);
		expect(
			await ctx.db.query("learningSessionAnswerAttempts").take(1),
		).toHaveLength(0);
	});
});

test("enforces subject eligibility and current AI consent", async () => {
	const { t, owner, sessionId } = await setup("Mathematik");
	await expect(
		owner.mutation(api.learningPodcasts.request, { sessionId }),
	).rejects.toThrow("sprachlichen");
	await t.run(async (ctx) => {
		const session = await ctx.db.get("learningPlanSessions", sessionId);
		if (!session) throw new Error("Missing fixture");
		await ctx.db.patch("learningPlans", session.learningPlanId, {
			subject: "Deutsch",
		});
		const user = await ctx.db.query("users").first();
		if (user)
			await ctx.db.patch("users", user._id, { aiConsentStatus: "withdrawn" });
	});
	await expect(
		owner.mutation(api.learningPodcasts.request, { sessionId }),
	).rejects.toThrow("KI-Datenverarbeitung");
});

test("rejects invalid progress and answers", async () => {
	const { owner, podcastId } = await setup();
	await expect(
		owner.mutation(api.learningPodcasts.saveProgress, {
			podcastId,
			positionSeconds: Number.NaN,
		}),
	).rejects.toThrow();
	await expect(
		owner.mutation(api.learningPodcasts.answer, {
			podcastId,
			questionIndex: -1,
			optionIndex: 0,
		}),
	).rejects.toThrow();
	await expect(
		owner.mutation(api.learningPodcasts.answer, {
			podcastId,
			questionIndex: 0,
			optionIndex: 3,
		}),
	).rejects.toThrow();
});

test("changed source prevents a background worker from publishing stale audio", async () => {
	const { t, itemId, podcastId } = await setup();
	await t.run((ctx) =>
		ctx.db.patch("learningSessionContentItems", itemId, { updatedAt: 2 }),
	);
	await expect(
		t.query(internal.learningPodcasts.generationContext, {
			podcastId,
			attempt: 1,
		}),
	).rejects.toThrow("source changed");
});

test("hides ready audio after the source or learning goal changes", async () => {
	const { t, owner, sessionId, itemId } = await setup();
	expect(
		(await owner.query(api.learningPodcasts.get, { sessionId })).episode,
	).not.toBeNull();
	await t.run((ctx) =>
		ctx.db.patch("learningPlanSessions", sessionId, { goal: "Neues Lernziel" }),
	);
	expect(
		(await owner.query(api.learningPodcasts.get, { sessionId })).episode,
	).toBeNull();
	await t.run(async (ctx) => {
		await ctx.db.patch("learningPlanSessions", sessionId, {
			goal: "Metaphern erkennen",
		});
		await ctx.db.patch("learningSessionContentItems", itemId, { updatedAt: 2 });
	});
	expect(
		(await owner.query(api.learningPodcasts.get, { sessionId })).episode,
	).toBeNull();
});

test("custom languages require owner confirmation and non-language subjects stay disabled", async () => {
	const { t, owner, sessionId } = await setup("Kroatisch");
	expect(
		await owner.query(api.learningPodcasts.get, { sessionId }),
	).toMatchObject({ eligible: false, needsLanguageConfirmation: true });
	await expect(
		t
			.withIdentity({ tokenIdentifier: "other" })
			.mutation(api.learningPodcasts.confirmLanguageSubject, { sessionId }),
	).rejects.toThrow();
	await owner.mutation(api.learningPodcasts.confirmLanguageSubject, {
		sessionId,
	});
	expect(
		await owner.query(api.learningPodcasts.get, { sessionId }),
	).toMatchObject({ eligible: true, needsLanguageConfirmation: false });
	const math = await setup("Mathematik");
	await expect(
		math.owner.mutation(api.learningPodcasts.confirmLanguageSubject, {
			sessionId: math.sessionId,
		}),
	).rejects.toThrow("kein Sprachfach");
});

test("material access stops immediately when account deletion begins", async () => {
	const { t, owner, planId } = await setup();
	const documentId = await t.run(async (ctx) => {
		const id = await ctx.db.insert("learningPlanDocuments", {
			ownerTokenIdentifier: "owner",
			learningPlanId: planId,
			storageId: "test",
			storageProvider: "r2",
			fileName: "theory.pdf",
			fileType: "application/pdf",
			fileSizeBytes: 12,
			createdAt: 1,
		});
		await ctx.db.insert("accountDeletionRequests", {
			requestId: "test-delete",
			ownerTokenIdentifier: "owner",
			status: "queued",
			stage: "revokeSessions",
			attemptCount: 0,
			deletedRecords: 0,
			policyVersion: "test",
			requestedAt: 1,
			updatedAt: 1,
		});
		return id;
	});
	await expect(
		owner.query(internal.learningPodcasts.sourceContext, { documentId }),
	).rejects.toThrow("dauerhaft gelöscht");
});
