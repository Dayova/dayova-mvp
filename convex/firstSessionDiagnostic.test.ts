/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AI_CONSENT_VERSION } from "../src/lib/ai-consent";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type TestBackend = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

const user = { tokenIdentifier: "test:first-session-diagnostic" };

const topics = [
	{
		id: "algebra",
		title: "Lineare Gleichungen",
		learningGoal: "Lineare Gleichungen sicher lösen.",
		keywords: ["Gleichung"],
		priority: "high" as const,
		requiredEvidenceDimensions: ["understanding" as const],
	},
	{
		id: "funktionen",
		title: "Lineare Funktionen",
		learningGoal: "Lineare Funktionen sicher beschreiben.",
		keywords: ["Funktion"],
		priority: "high" as const,
		requiredEvidenceDimensions: ["understanding" as const],
	},
];

const buildDiagnosticQuestions = (count = 5) =>
	Array.from({ length: count }, (_, index) => ({
		id: `q${index + 1}`,
		prompt:
			index === 0
				? "Welche Zahl löst die Gleichung 2x = 8?"
				: `Erkläre den Fachbegriff ${index + 1} in einem Satz.`,
		targetInsight: "Prüft das aktuelle fachliche Verständnis.",
		topicId: index % 2 === 0 ? "algebra" : "funktionen",
		kind: "performance" as const,
		responseKind:
			index === 0 ? ("multipleChoice" as const) : ("shortText" as const),
		options: index === 0 ? ["2", "4", "8"] : [],
		correctAnswer: index === 0 ? "4" : undefined,
		idealAnswer: index === 0 ? "4" : `Fachlich richtige Antwort ${index + 1}.`,
		explanation:
			index === 0
				? "Teile beide Seiten durch 2; dadurch ergibt sich x = 4."
				: "Die Antwort nennt die wesentliche fachliche Bedeutung.",
		evidenceDimension: "understanding" as const,
		evaluationKeywords:
			index === 0 ? ["4"] : ["fachlich", `antwort-${index + 1}`],
	}));

const createPlan = async (t: TestBackend) => {
	const examDayEntryId = await t.mutation(api.dayEntries.create, {
		dayKey: "2026-06-05",
		title: "Mathe Klausur",
		subject: "Mathe",
		time: "09:00",
		kind: "Leistungskontrolle",
		plannedDateLabel: "5. Juni 2026",
		durationMinutes: 90,
		examTypeLabel: "Klausur",
	});
	return await t.mutation(api.learningPlans.start, {
		examDayEntryId,
		subject: "Mathe",
		examTypeLabel: "Klausur",
		examDateKey: "2026-06-05",
		examDateLabel: "5. Juni 2026",
		examTime: "09:00",
		durationMinutes: 90,
		topicDescription: "Lineare Gleichungen und Funktionen",
	});
};

const storeDiagnostic = async (t: TestBackend, learningPlanId: string) => {
	await t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
		learningPlanId: learningPlanId as never,
		sourceSummary: "Lineare Gleichungen und Funktionen sind prüfungsrelevant.",
		topics,
		questions: buildDiagnosticQuestions(),
		diagnosticPlacement: "firstSession",
	});
};

const generatedSlots = [
	{
		phase: "theory" as const,
		title: "Erster Slot",
		dateKey: "2026-06-01",
		dateLabel: "1. Juni 2026",
		startTime: "17:00",
		durationMinutes: 10,
		goal: "Grundlagen prüfen.",
		tasks: ["Kurze Aufgaben bearbeiten."],
		expectedOutcome: "Der Wissensstand ist sichtbar.",
	},
	{
		phase: "practice" as const,
		title: "Zweiter Slot",
		dateKey: "2026-06-02",
		dateLabel: "2. Juni 2026",
		startTime: "17:00",
		durationMinutes: 10,
		goal: "Den nächsten Schwerpunkt bearbeiten.",
		tasks: ["Eine passende Aufgabe lösen."],
		expectedOutcome: "Der nächste Lernschritt ist begonnen.",
	},
];

const answerDiagnostic = async (
	t: TestBackend,
	sessionId: Id<"learningPlanSessions">,
	correct: boolean,
) => {
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const items = content.items;
	for (const item of items) {
		if (item.kind === "multipleChoice") {
			const selectedChoiceId = correct
				? item.choices.find((choice) => choice.text === "4")?.id
				: item.choices.find((choice) => choice.text !== "4")?.id;
			if (!selectedChoiceId) throw new Error("Expected a diagnostic choice.");
			await t.mutation(api.learningSessionContent.submitAnswer, {
				itemId: item.id,
				selectedChoiceId,
			});
		} else {
			await t.mutation(
				internal.learningSessionContent.storeEvaluatedWrittenAnswer,
				{
					itemId: item.id,
					answerText: correct ? item.idealAnswer : "Ich weiß es nicht.",
					rating: correct ? "correct" : "notCorrect",
					feedback: correct
						? "Die Antwort deckt die erwartete Lösung ab."
						: "Es wurde noch keine fachliche Antwort gegeben.",
				},
			);
		}
	}
	return items;
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-05-30T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

test("materializes the 5-10 question diagnostic and exactly one provisional preview", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(api.learningPlans.setTargetStudyMinutes, {
		learningPlanId,
		targetStudyMinutes: 40,
	});

	const replacement = await t.mutation(
		internal.learningPlans.replaceGeneratedSessions,
		{
			learningPlanId,
			knowledgeAnswersJson: "[]",
			sourceSummary: "Lineare Gleichungen und Funktionen.",
			insight: {
				summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
				strengths: [],
				gaps: ["Der aktuelle Wissensstand ist noch offen."],
			},
			deferReadyUntilContent: true,
			deferFutureContent: true,
			rollingWindow: true,
			sessions: generatedSlots,
		},
	);

	expect(replacement?.sessionIds).toHaveLength(2);
	expect(replacement?.contentSessionIds).toEqual([]);
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.plan.diagnosticPlacement).toBe("firstSession");
	expect(snapshot?.sessions).toHaveLength(2);
	expect(snapshot?.sessions[0]).toMatchObject({
		phase: "practice",
		title: "Wissenscheck",
		compositionVariant: "control",
		sessionPurpose: "diagnostic",
		planningStatus: "committed",
		contentGenerationStatus: "ready",
	});
	expect(snapshot?.sessions[1]).toMatchObject({
		sessionPurpose: "learning",
		planningStatus: "provisional",
	});
	expect(snapshot?.sessions[1]?.contentGenerationStatus).toBeUndefined();

	const diagnosticSessionId = snapshot?.sessions[0]?.id;
	const previewSessionId = snapshot?.sessions[1]?.id;
	if (!diagnosticSessionId || !previewSessionId) {
		throw new Error("Expected diagnostic and preview sessions.");
	}
	const { diagnosticItems, previewItems } = await t.run(async (ctx) => ({
		diagnosticItems: await ctx.db
			.query("learningSessionContentItems")
			.withIndex("by_sessionId_and_sortOrder", (q) =>
				q.eq("sessionId", diagnosticSessionId),
			)
			.take(20),
		previewItems: await ctx.db
			.query("learningSessionContentItems")
			.withIndex("by_sessionId_and_sortOrder", (q) =>
				q.eq("sessionId", previewSessionId),
			)
			.take(20),
	}));
	expect(diagnosticItems).toHaveLength(5);
	expect(previewItems).toEqual([]);
	expect(diagnosticItems[0]).toMatchObject({
		kind: "multipleChoice",
		evidenceDimension: "understanding",
		questionAngle: "diagnostic",
	});
	expect(
		diagnosticItems[0]?.choices?.find(
			(choice) => choice.id === diagnosticItems[0]?.correctChoiceId,
		)?.text,
	).toBe("4");
	await expect(
		t.action(api.learningPlanAi.ensureSessionContent, {
			sessionId: diagnosticSessionId,
		}),
	).resolves.toEqual({ itemCount: 5 });

	await t.mutation(internal.learningPlans.finalizeContentGeneration, {
		learningPlanId,
	});
	await t.mutation(api.learningPlans.acceptPlan, { learningPlanId });
	const diagnosticDay = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-01"],
	});
	const diagnosticEntry = diagnosticDay["2026-06-01"]?.find(
		(entry) => entry.relatedLearningPlanSessionId === diagnosticSessionId,
	);
	if (!diagnosticEntry) throw new Error("Expected diagnostic calendar entry.");
	await expect(
		t.mutation(api.dayEntries.setCompleted, {
			id: diagnosticEntry.id as never,
			completed: true,
		}),
	).rejects.toThrow("Öffne den Lernblock");
	const overview = await t.query(api.learningPlans.listOverview, {});
	expect(overview[0]).toMatchObject({
		id: learningPlanId,
		progressPercent: 0,
		upcomingSessionCount: 2,
		rollingPlanEnabled: true,
		hasOpenRollingWindow: true,
		currentSession: { sessionPurpose: "diagnostic" },
	});
	const previewDay = await t.query(api.dayEntries.listByDayKeys, {
		dayKeys: ["2026-06-02"],
	});
	expect(
		previewDay["2026-06-02"]?.some(
			(entry) => entry.relatedLearningPlanSessionId === previewSessionId,
		),
	).toBe(false);
});

test("rejects an undersized diagnostic without mutating the draft", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await expect(
		t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId,
			sourceSummary: "Lineare Gleichungen und Funktionen.",
			topics,
			questions: buildDiagnosticQuestions(4),
			diagnosticPlacement: "firstSession",
		}),
	).rejects.toThrow("5 bis 10 Fragen");
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.plan.status).toBe("draft");
	expect(snapshot?.plan.diagnosticPlacement).toBeUndefined();
});

test("accepts ten diagnostic questions and rejects eleven", async () => {
	const acceptedBackend = convexTest(schema, modules).withIdentity(user);
	const acceptedPlanId = await createPlan(acceptedBackend);
	await expect(
		acceptedBackend.mutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId: acceptedPlanId,
			sourceSummary: "Lineare Gleichungen und Funktionen.",
			topics,
			questions: buildDiagnosticQuestions(10),
			diagnosticPlacement: "firstSession",
		}),
	).resolves.toBeNull();
	const acceptedSnapshot = await acceptedBackend.query(
		api.learningPlans.getSnapshot,
		{ id: acceptedPlanId },
	);
	expect(acceptedSnapshot?.plan.knowledgeQuestions).toHaveLength(10);

	const rejectedBackend = convexTest(schema, modules).withIdentity(user);
	const rejectedPlanId = await createPlan(rejectedBackend);
	await expect(
		rejectedBackend.mutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId: rejectedPlanId,
			sourceSummary: "Lineare Gleichungen und Funktionen.",
			topics,
			questions: buildDiagnosticQuestions(11),
			diagnosticPlacement: "firstSession",
		}),
	).rejects.toThrow("5 bis 10 Fragen");
});

test("keeps question topic references aligned when topic IDs are normalized", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	const inputTopicId = "Lineare Funktionen";
	await t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
		learningPlanId,
		sourceSummary: "Lineare Funktionen sind prüfungsrelevant.",
		topics: [
			{
				id: inputTopicId,
				title: "Lineare Funktionen",
				learningGoal: "Lineare Funktionen sicher beschreiben.",
				keywords: ["Funktion"],
				priority: "high",
				requiredEvidenceDimensions: ["understanding"],
			},
		],
		questions: buildDiagnosticQuestions().map((question) => ({
			...question,
			topicId: inputTopicId,
		})),
		diagnosticPlacement: "firstSession",
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.plan.topicMap?.[0]?.id).toBe("lineare-funktionen");
	expect(
		snapshot?.plan.knowledgeQuestions.every(
			(question) => question.topicId === "lineare-funktionen",
		),
	).toBe(true);
});

test("requires two dated slots before replacing an existing diagnostic window", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	const replaceArgs = {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [] as string[],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
	};
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		...replaceArgs,
		sessions: generatedSlots,
	});
	await expect(
		t.mutation(internal.learningPlans.replaceGeneratedSessions, {
			...replaceArgs,
			sessions: generatedSlots.slice(0, 1),
		}),
	).rejects.toThrow("zwei freie Lernzeiten");
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(snapshot?.sessions).toHaveLength(2);
	expect(snapshot?.sessions[0]?.sessionPurpose).toBe("diagnostic");
});

test("does not count an unattempted provisional target as already taught", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: generatedSlots,
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSession = initial?.sessions[0];
	const initialPreviewTopicId = initial?.sessions[1]?.targetTopicIds?.[0];
	expect(initial?.sessions[1]).toMatchObject({
		planningStatus: "provisional",
	});
	if (!diagnosticSession || !initialPreviewTopicId) {
		throw new Error("Expected diagnostic session and preview target.");
	}

	await answerDiagnostic(t, diagnosticSession.id, false);
	await t.mutation(api.learningSessionContent.finishSessionContent, {
		sessionId: diagnosticSession.id,
	});
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSession.id,
		completed: true,
	});
	const advanced = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const futureSessions = advanced?.sessions.filter((session) =>
		["notStarted", "started"].includes(session.executionStatus),
	);
	expect(futureSessions).toHaveLength(2);
	expect(
		futureSessions?.find((session) => session.planningStatus === "committed"),
	).toMatchObject({
		sessionPurpose: "learning",
		targetTopicIds: [initialPreviewTopicId],
		targetEvidenceDimension: "understanding",
	});
});

test("completing one answered diagnostic twice advances only once", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 2,
		startTime: "17:00",
		endTime: "18:00",
	});
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: generatedSlots,
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSessionId = initial?.sessions[0]?.id;
	if (!diagnosticSessionId) throw new Error("Expected diagnostic session.");
	await answerDiagnostic(t, diagnosticSessionId, false);
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSessionId,
		completed: true,
	});
	const afterFirstCompletion = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSessionId,
		completed: true,
	});
	const afterSecondCompletion = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const openSessionIds = (snapshot: typeof afterFirstCompletion) =>
		(snapshot?.sessions ?? [])
			.filter((session) => session.executionStatus === "notStarted")
			.map((session) => session.id);
	expect(openSessionIds(afterFirstCompletion)).toHaveLength(2);
	expect(openSessionIds(afterSecondCompletion)).toEqual(
		openSessionIds(afterFirstCompletion),
	);
});

test("does not invent a rolling slot when no learning time is saved", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: generatedSlots,
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSessionId = initial?.sessions[0]?.id;
	if (!diagnosticSessionId) throw new Error("Expected diagnostic session.");
	await answerDiagnostic(t, diagnosticSessionId, false);
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSessionId,
		completed: true,
	});
	const advanced = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const openSessions = advanced?.sessions.filter(
		(session) => session.executionStatus === "notStarted",
	);
	expect(openSessions).toHaveLength(1);
	expect(openSessions?.[0]?.planningStatus).toBe("committed");
	expect(
		advanced?.sessions.some(
			(session) => session.planningStatus === "provisional",
		),
	).toBe(false);
});

test("requires every diagnostic answer before the rolling plan can advance", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: generatedSlots,
	});
	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSessionId = snapshot?.sessions[0]?.id;
	if (!diagnosticSessionId) throw new Error("Expected diagnostic session.");

	await expect(
		t.mutation(api.learningSessionContent.finishSessionContent, {
			sessionId: diagnosticSessionId,
		}),
	).rejects.toThrow("alle Fragen");
	await t.mutation(api.learningPlans.startSession, {
		sessionId: diagnosticSessionId,
	});
	await expect(
		t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId: diagnosticSessionId,
			outcome: "partiallyCompleted",
		}),
	).rejects.toThrow("vollständig");
	await expect(
		t.mutation(api.learningPlans.recordSessionOutcome, {
			sessionId: diagnosticSessionId,
			outcome: "completed",
		}),
	).rejects.toThrow("alle Fragen");
	await expect(
		t.mutation(api.learningPlans.setSessionCompleted, {
			sessionId: diagnosticSessionId,
			completed: true,
		}),
	).rejects.toThrow("alle Fragen");
});

test("keeps previews non-interactive and regenerates leaked content on promotion", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: generatedSlots,
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSessionId = initial?.sessions[0]?.id;
	const preview = initial?.sessions[1];
	if (!diagnosticSessionId || !preview) {
		throw new Error("Expected diagnostic and preview sessions.");
	}
	const leakedItemId = await t.run(async (ctx) => {
		const now = Date.now();
		return await ctx.db.insert("learningSessionContentItems", {
			ownerTokenIdentifier: user.tokenIdentifier,
			learningPlanId,
			sessionId: preview.id,
			phase: "theory",
			kind: "written",
			title: "Veraltete Vorschau",
			prompt: "Diese Aufgabe entstand vor dem Wissenscheck.",
			explanation: "Dieser Inhalt muss nach neuer Evidenz ersetzt werden.",
			idealAnswer: "Aktualisierte Aufgabe",
			evaluationKeywords: ["aktualisiert"],
			topicId: preview.targetTopicIds?.[0],
			evidenceDimension: preview.targetEvidenceDimension,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});
	});

	await expect(
		t.query(api.learningSessionContent.getSessionContent, {
			sessionId: preview.id,
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.action(api.learningPlanAi.ensureSessionContent, {
			sessionId: preview.id,
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.mutation(api.learningSessionContent.ensureSessionContent, {
			sessionId: preview.id,
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.mutation(api.learningSessionContent.extendSessionContent, {
			sessionId: preview.id,
			durationMinutes: 5,
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.mutation(api.learningSessionContent.submitAnswer, {
			itemId: leakedItemId,
			answerText: "Alt",
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.mutation(api.learningSessionContent.finishSessionContent, {
			sessionId: preview.id,
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.mutation(api.learningSessionContent.deferTheoryValidation, {
			sessionId: preview.id,
		}),
	).rejects.toThrow("Vorschau");
	await expect(
		t.mutation(internal.learningSessionContent.ensureFallbackSessionContent, {
			sessionId: preview.id,
		}),
	).rejects.toThrow("Vorschau");

	await answerDiagnostic(t, diagnosticSessionId, false);
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSessionId,
		completed: true,
	});
	const advanced = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const promoted = advanced?.sessions.find(
		(session) => session.id === preview.id,
	);
	expect(promoted).toMatchObject({
		planningStatus: "committed",
		targetTopicIds: preview.targetTopicIds,
		targetEvidenceDimension: preview.targetEvidenceDimension,
		contentGenerationStatus: "queued",
	});
	if (!promoted) throw new Error("Expected promoted learning session.");
	const generationContext = await t.query(
		internal.learningSessionContent.getSessionGenerationContext,
		{ sessionId: promoted.id },
	);
	expect(generationContext.priorSessionEvidence).toHaveLength(5);
	expect(
		generationContext.priorSessionEvidence.every(
			(evidence) => evidence.rating === "notCorrect",
		),
	).toBe(true);
	expect(
		generationContext.priorSessionEvidence.some(
			(evidence) => evidence.response === "Ich weiß es nicht.",
		),
	).toBe(true);
	await expect(
		t.run(
			async (ctx) =>
				await ctx.db.get("learningSessionContentItems", leakedItemId),
		),
	).resolves.toBeNull();
});

test("keeps a future same-day preview and appends the next same-day slot", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 6,
		startTime: "13:00",
		endTime: "14:00",
	});
	const sameDaySlots = generatedSlots.map((slot, index) => ({
		...slot,
		dateKey: "2026-05-30",
		dateLabel: "30. Mai 2026",
		startTime: index === 0 ? "13:00" : "13:10",
	}));
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: sameDaySlots,
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSessionId = initial?.sessions[0]?.id;
	const previewSessionId = initial?.sessions[1]?.id;
	if (!diagnosticSessionId || !previewSessionId) {
		throw new Error("Expected diagnostic and preview sessions.");
	}
	await answerDiagnostic(t, diagnosticSessionId, false);
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSessionId,
		completed: true,
	});
	const advanced = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	expect(
		advanced?.sessions.find((session) => session.id === previewSessionId),
	).toMatchObject({
		dateKey: "2026-05-30",
		startTime: "13:10",
		planningStatus: "committed",
	});
	expect(
		advanced?.sessions.find(
			(session) => session.planningStatus === "provisional",
		),
	).toMatchObject({
		dateKey: "2026-05-30",
		startTime: "13:20",
	});
});

test("never schedules outside saved learning windows", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	const learningPlanId = await createPlan(t);
	await storeDiagnostic(t, learningPlanId);
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 6,
		startTime: "13:00",
		endTime: "13:10",
	});
	await t.mutation(api.learningTimes.upsertMine, {
		dayOfWeek: 1,
		startTime: "15:00",
		endTime: "16:00",
	});
	const initialSlots = generatedSlots.map((slot, index) => ({
		...slot,
		dateKey: "2026-05-30",
		dateLabel: "30. Mai 2026",
		startTime: index === 0 ? "13:00" : "13:10",
	}));
	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: "[]",
		sourceSummary: "Lineare Gleichungen und Funktionen.",
		insight: {
			summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
			strengths: [],
			gaps: ["Wissensstand offen."],
		},
		deferReadyUntilContent: true,
		deferFutureContent: true,
		rollingWindow: true,
		sessions: initialSlots,
	});
	const initial = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const diagnosticSessionId = initial?.sessions[0]?.id;
	const previewSessionId = initial?.sessions[1]?.id;
	if (!diagnosticSessionId || !previewSessionId) {
		throw new Error("Expected diagnostic and preview sessions.");
	}
	await t.mutation(api.learningPlans.removeSession, { id: previewSessionId });
	await answerDiagnostic(t, diagnosticSessionId, false);
	await t.mutation(api.learningPlans.setSessionCompleted, {
		sessionId: diagnosticSessionId,
		completed: true,
	});
	const advanced = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const upcoming = advanced?.sessions.filter((session) => !session.completed);
	expect(upcoming).toHaveLength(2);
	expect(upcoming).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ dateKey: "2026-06-01", startTime: "15:00" }),
			expect.objectContaining({ dateKey: "2026-06-01", startTime: "15:10" }),
		]),
	);
});

test("uses diagnostic correctness to choose a different evidence target", async () => {
	const adaptiveTopics = topics.map((topic) => ({
		...topic,
		requiredEvidenceDimensions: [
			"understanding" as const,
			"problemSolving" as const,
			"independent" as const,
		],
	}));
	const runDiagnostic = async (correct: boolean) => {
		const t = convexTest(schema, modules).withIdentity(user);
		const learningPlanId = await createPlan(t);
		await t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
			learningPlanId,
			sourceSummary: "Lineare Gleichungen und Funktionen.",
			topics: adaptiveTopics,
			questions: buildDiagnosticQuestions(),
			diagnosticPlacement: "firstSession",
		});
		await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
			learningPlanId,
			knowledgeAnswersJson: "[]",
			sourceSummary: "Lineare Gleichungen und Funktionen.",
			insight: {
				summary: "Der Wissenscheck bestimmt den nächsten Schwerpunkt.",
				strengths: [],
				gaps: ["Wissensstand offen."],
			},
			deferReadyUntilContent: true,
			deferFutureContent: true,
			rollingWindow: true,
			sessions: generatedSlots,
		});
		const initial = await t.query(api.learningPlans.getSnapshot, {
			id: learningPlanId,
		});
		const diagnosticSessionId = initial?.sessions[0]?.id;
		if (!diagnosticSessionId) throw new Error("Expected diagnostic session.");
		await answerDiagnostic(t, diagnosticSessionId, correct);
		await t.mutation(api.learningPlans.setSessionCompleted, {
			sessionId: diagnosticSessionId,
			completed: true,
		});
		return await t.query(api.learningPlans.getSnapshot, { id: learningPlanId });
	};

	const correctResult = await runDiagnostic(true);
	const wrongResult = await runDiagnostic(false);
	const correctTarget = correctResult?.sessions.find(
		(session) => session.planningStatus === "committed" && !session.completed,
	);
	const wrongTarget = wrongResult?.sessions.find(
		(session) => session.planningStatus === "committed" && !session.completed,
	);
	expect(correctTarget?.targetEvidenceDimension).toBe("problemSolving");
	expect(wrongTarget?.targetEvidenceDimension).toBe("understanding");
	expect(correctResult?.plan.topicReadiness).toEqual(
		expect.arrayContaining([expect.objectContaining({ status: "secure" })]),
	);
	expect(wrongResult?.plan.topicReadiness).toEqual(
		expect.arrayContaining([expect.objectContaining({ status: "developing" })]),
	);
});

test("does not start diagnostic generation from required topics without material", async () => {
	const t = convexTest(schema, modules).withIdentity(user);
	await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			tokenIdentifier: user.tokenIdentifier,
			clerkId: "first-session-diagnostic",
			email: "student@example.com",
			aiConsentStatus: "granted",
			aiConsentVersion: AI_CONSENT_VERSION,
			aiConsentGrantedAt: 1,
			aiConsentUpdatedAt: 1,
		});
	});
	const learningPlanId = await createPlan(t);
	await t.mutation(api.learningPlans.updateRequiredTopics, {
		id: learningPlanId,
		topicDescription:
			"Die Klausur behandelt lineare Gleichungen und lineare Funktionen aus Kapitel drei.",
	});
	await expect(
		t.action(api.learningPlanAi.generateKnowledgeQuestions, { learningPlanId }),
	).rejects.toThrow("Schulunterlage");
});
