/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
	MAX_MULTIPLE_CHOICE_OPTION_CHARS,
	MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
	MULTIPLE_CHOICE_OPTION_COUNT,
} from "./learningSessionContentConstraints";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

const createGeneratedPlanWithSession = async (
	phase: "theory" | "practice" | "rehearsal",
	sessionCompositionVariant: "control" | "split" = "control",
	durationMinutes = 30,
) => {
	const t = convexTest(schema, modules).withIdentity(user);
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
		topicDescription: "Lineare Gleichungen und Äquivalenzumformungen",
	});
	await t.mutation(internal.learningPlans.storeKnowledgeQuestions, {
		learningPlanId,
		sourceSummary:
			"Lineare Gleichungen mit besonderem Fokus auf Klammern und Vorzeichen.",
		questions: [
			{
				id: "q1",
				prompt: "Wo passieren dir Vorzeichenfehler?",
				targetInsight: "Sicherheit bei Klammern",
			},
		],
		topics: [
			{
				id: "vorzeichen-und-klammern",
				title: "Vorzeichen und Klammern",
				learningGoal:
					"Klammern korrekt auflösen und jedes Vorzeichen nachvollziehbar prüfen.",
				keywords: ["Klammern", "Vorzeichen", "Minusklammer"],
				priority: "high",
			},
			{
				id: "aequivalenzumformungen",
				title: "Äquivalenzumformungen",
				learningGoal:
					"Auf beiden Seiten dieselbe Operation ausführen und die Lösungsmenge erhalten.",
				keywords: ["Operation", "Lösungsmenge", "Gleichung"],
				priority: "high",
			},
		],
	});

	await t.mutation(internal.learningPlans.replaceGeneratedSessions, {
		learningPlanId,
		knowledgeAnswersJson: JSON.stringify([
			{
				questionId: "q1",
				answer: "Ich verwechsle Vorzeichen beim Umformen.",
			},
		]),
		sourceSummary:
			"Es geht um lineare Gleichungen, Äquivalenzumformungen und Vorzeichen.",
		insight: {
			summary: "Vorzeichen und Umformungsschritte brauchen Aufmerksamkeit.",
			strengths: ["Grundbegriffe sind vorhanden."],
			gaps: ["Vorzeichenfehler beim Auflösen von Gleichungen."],
		},
		sessionCompositionVariant,
		sessions: [
			{
				phase,
				title:
					phase === "theory"
						? "Theorie"
						: phase === "practice"
							? "Üben"
							: "Praxis",
				dateKey: "2026-06-03",
				dateLabel: "3. Juni 2026",
				startTime: "16:00",
				durationMinutes,
				goal: "Lineare Gleichungen mit Äquivalenzumformungen sicher lösen.",
				tasks: [
					"Vorzeichen bei Klammern prüfen.",
					"Probe durch Einsetzen durchführen.",
				],
				expectedOutcome:
					"Du löst kurze Gleichungen sicher und erkennst Vorzeichenfehler.",
			},
		],
	});

	const snapshot = await t.query(api.learningPlans.getSnapshot, {
		id: learningPlanId,
	});
	const session = snapshot?.sessions[0];
	if (!session) throw new Error("Expected generated session.");

	return { t, sessionId: session.id };
};

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-05-30T10:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

test("session content is generated once and reused on reopen", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("practice");

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const firstSnapshot = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const secondSnapshot = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);

	expect(firstSnapshot?.items.map((item) => item.id)).toEqual(
		secondSnapshot?.items.map((item) => item.id),
	);
	expect(firstSnapshot?.items.map((item) => item.kind)).toEqual(
		expect.arrayContaining(["multipleChoice", "written", "voice"]),
	);
});

test("theory fallback creates active recall cards instead of generic summaries", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("theory");

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});

	expect(content?.items).toHaveLength(9);
	expect(content?.items.every((item) => item.kind === "learnCard")).toBe(true);
	expect(content?.items[0]).toMatchObject({
		front: expect.stringContaining("?"),
		back: expect.stringContaining("Beispiel:"),
		theoryContent: {
			conceptTitle: expect.any(String),
			question: expect.stringContaining("?"),
			explanation: expect.any(String),
			keyPoints: expect.any(Array),
			example: expect.any(String),
			memoryCue: expect.any(String),
			commonMistake: expect.any(String),
		},
	});
	expect(
		content?.items[0]?.theoryContent?.keyPoints.length,
	).toBeGreaterThanOrEqual(2);
	expect(
		content?.items[0]?.theoryContent?.keyPoints.length,
	).toBeLessThanOrEqual(4);
	expect(content?.items.map((item) => item.back).join(" ")).not.toContain(
		"Merke dir besonders, wie das Lernziel",
	);
	expect(
		content?.items.map((item) => item.theoryContent?.explanation).join(" "),
	).toContain("Klammern korrekt auflösen");
	expect(content?.items.map((item) => item.prompt).join(" ")).not.toContain(
		"im Grundfall",
	);
	for (const item of content?.items ?? []) {
		expect(item.theoryContent?.example).not.toBe(item.theoryContent?.memoryCue);
	}
});

test("opening an existing short theory session backfills its pre-check", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession(
		"theory",
		"control",
		7,
	);
	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});

	const before = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	expect(before?.items.every((item) => item.kind === "learnCard")).toBe(true);

	await t.action(api.learningPlanAi.ensureSessionContent, { sessionId });

	const after = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	expect(after?.session).toMatchObject({
		compositionVariant: "split",
		knowledgeValidationStatus: "pending",
	});
	expect(
		after?.items.filter(
			(item) =>
				item.phase === "practice" && item.coverageKey.includes(":validation:"),
		),
	).toHaveLength(1);
	expect(
		after?.items.find((item) => item.phase === "practice")?.prompt,
	).toContain(before?.items[0]?.front);
});

test("split fallback stores one practical check before theory", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession(
		"theory",
		"split",
	);

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});

	expect(content?.session.compositionVariant).toBe("split");
	expect(content?.items).toHaveLength(9);
	expect(
		content?.items.slice(0, 1).every((item) => item.phase === "practice"),
	).toBe(true);
	expect(content?.items.slice(1).every((item) => item.phase === "theory")).toBe(
		true,
	);
	expect(
		content?.items.slice(0, 1).every((item) => item.kind !== "learnCard"),
	).toBe(true);
	expect(
		content?.items.slice(1).every((item) => item.kind === "learnCard"),
	).toBe(true);
	expect(
		content?.items.reduce((total, item) => total + item.estimatedSeconds, 0),
	).toBe(30 * 60);
	expect(new Set(content?.items.map((item) => item.coverageKey)).size).toBe(9);
	expect(content?.items.map((item) => item.learningBlockIndex)).toEqual([
		0,
		...Array.from({ length: 3 }, () => 1),
		...Array.from({ length: 3 }, () => 2),
		...Array.from({ length: 2 }, () => 3),
	]);
});

test("persists deferred and completed theory validation states", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession(
		"theory",
		"split",
	);
	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});

	await t.mutation(api.learningSessionContent.deferTheoryValidation, {
		sessionId,
	});
	const deferred = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	expect(deferred?.session.knowledgeValidationStatus).toBe("skipped");

	await t.mutation(api.learningSessionContent.finishSessionContent, {
		sessionId,
		knowledgeValidationConfidence: "sure",
	});
	const unchecked = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);
	expect(unchecked?.session.knowledgeValidationStatus).toBe("skipped");

	const validationItems =
		deferred?.items.filter((item) => item.phase === "practice") ?? [];
	expect(validationItems).toHaveLength(1);
	for (const item of validationItems) {
		await t.mutation(api.learningSessionContent.submitAnswer, {
			itemId: item.id,
			...(item.kind === "multipleChoice"
				? { selectedChoiceId: item.choices[0]?.id }
				: {
						answerText:
							"Ich erkläre den Zusammenhang Schritt für Schritt und wende ihn anschließend auf ein neues Beispiel an.",
					}),
		});
	}
	await t.mutation(api.learningSessionContent.finishSessionContent, {
		sessionId,
		knowledgeValidationConfidence: "somewhatSure",
	});

	const completed = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);
	expect(completed?.session).toMatchObject({
		knowledgeValidationStatus: "completed",
		knowledgeValidationConfidence: "somewhatSure",
	});
});

test("continue learning appends a fresh timed block", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession(
		"theory",
		"split",
	);
	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const before = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const existingCoverageKeys =
		before?.items.map((item) => item.coverageKey) ?? [];

	const extension = await t.mutation(
		api.learningSessionContent.extendSessionContent,
		{ sessionId, durationMinutes: 10 },
	);
	const after = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const newItems = after?.items.slice(extension.firstNewItemIndex) ?? [];

	expect(extension).toMatchObject({
		firstNewItemIndex: 9,
		addedItemCount: 3,
		durationMinutes: 10,
	});
	expect(after?.items.slice(0, 9).map((item) => item.id)).toEqual(
		before?.items.map((item) => item.id),
	);
	expect(newItems.every((item) => item.learningBlockIndex === 4)).toBe(true);
	expect(
		newItems.some((item) => existingCoverageKeys.includes(item.coverageKey)),
	).toBe(false);

	const secondExtension = await t.mutation(
		api.learningSessionContent.extendSessionContent,
		{ sessionId, durationMinutes: 10 },
	);
	const twiceExtended = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);
	const allPrompts = twiceExtended?.items.map((item) => item.prompt) ?? [];
	const duplicatePrompts = allPrompts.filter(
		(prompt, index) => allPrompts.indexOf(prompt) !== index,
	);

	expect(secondExtension).toMatchObject({
		firstNewItemIndex: 12,
		addedItemCount: 3,
	});
	expect(duplicatePrompts).toEqual([]);
});

test("existing theory cards remain readable without structured topic content", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("theory");

	await t.mutation(
		internal.learningSessionContent.storeGeneratedSessionContent,
		{
			sessionId,
			items: [
				{
					kind: "learnCard",
					title: "Lernkarte 1",
					prompt: "Was ist eine Äquivalenzumformung?",
					front: "Was ist eine Äquivalenzumformung?",
					back: "Eine Umformung, die die Lösungsmenge erhält.",
					explanation: "Die Lösungsmenge bleibt unverändert.",
					idealAnswer: "Beide Seiten gleich behandeln.",
					evaluationKeywords: ["äquivalenzumformung"],
				},
			],
		},
	);

	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});

	expect(content?.items[0]).toMatchObject({
		title: "Lernkarte 1",
		front: "Was ist eine Äquivalenzumformung?",
		back: "Eine Umformung, die die Lösungsmenge erhält.",
	});
	expect(content?.items[0]?.theoryContent).toBeUndefined();
});

test("AI theory content gains a practical segment for split sessions", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession(
		"theory",
		"split",
	);

	await t.mutation(
		internal.learningSessionContent.storeGeneratedSessionContent,
		{
			sessionId,
			items: [
				{
					kind: "learnCard",
					title: "Steigung verstehen",
					prompt: "Was beschreibt die Steigung?",
					explanation: "Sie beschreibt die Änderung von y pro x-Schritt.",
					idealAnswer: "Änderung von y geteilt durch Änderung von x.",
					evaluationKeywords: ["steigung", "änderung"],
				},
			],
		},
	);

	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});

	expect(content?.items[0]?.phase).toBe("theory");
	expect(
		content?.items.filter((item) => item.phase === "practice"),
	).toHaveLength(1);
});

test("practice fallback creates concrete guided practice tasks", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("practice");

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const prompts = content?.items.map((item) => item.prompt).join(" ") ?? "";

	expect(content?.items).toHaveLength(8);
	expect(content?.items.slice(0, 6).map((item) => item.kind)).toEqual([
		"multipleChoice",
		"written",
		"voice",
		"multipleChoice",
		"written",
		"voice",
	]);
	expect(prompts).toContain("Übung");
	expect(prompts).not.toContain("Welche Strategie passt");
	expect(prompts).not.toContain("Variante ");
	expect(prompts).not.toContain('Lösungsweg zu "');
	expect(content?.items[0]?.choices[0]?.text).toContain("Probe");
});

test("marks shallow generated theory content for regeneration", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("theory");

	await t.mutation(
		internal.learningSessionContent.storeGeneratedSessionContent,
		{
			sessionId,
			items: [
				{
					kind: "learnCard",
					title: "Oktett-Grenzen",
					prompt: "Wie viele Bits umfasst ein einzelnes Oktett?",
					front: "Wie viele Bits umfasst ein einzelnes Oktett?",
					back: "Jedes Oktett hat 8 Bits.",
					explanation:
						"Jedes Oktett hat 8 Bits. Eine IPv4-Adresse besteht aus vier Oktetten.",
					idealAnswer: "8 Bits",
					theoryContent: {
						conceptTitle: "Oktett-Grenzen",
						question: "Wie viele Bits umfasst ein einzelnes Oktett?",
						explanation:
							"Jedes Oktett hat 8 Bits. Eine IPv4-Adresse besteht aus vier Oktetten.",
						keyPoints: ["8 Bits", "Achte besonders auf: 8."],
						example: "8 Bits",
						memoryCue: "8 Bits",
						commonMistake:
							"Vergleiche deine Antwort mit der Erklärung und prüfe den entscheidenden Schritt.",
					},
					evaluationKeywords: ["8"],
				},
			],
		},
	);

	const generationContext = await t.query(
		internal.learningSessionContent.getSessionGenerationContext,
		{ sessionId },
	);

	expect(generationContext.needsLegacyContentReplacement).toBe(true);
});

test("marks nested variant exercises for regeneration", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("practice");

	await t.mutation(
		internal.learningSessionContent.storeGeneratedSessionContent,
		{
			sessionId,
			items: [
				{
					kind: "voice",
					title: "Sprachaufgabe",
					prompt:
						'Übung: Erkläre laut deinen Lösungsweg zu "Variante 1: Erkläre die entscheidende Regel zur Berechnung verfügbarer Hosts".',
					explanation:
						"Eine starke Antwort erklärt den entscheidenden Rechenschritt.",
					idealAnswer: "Verwende die Formel 2^n - 2.",
					evaluationKeywords: ["2^n", "Hosts"],
				},
			],
		},
	);

	const generationContext = await t.query(
		internal.learningSessionContent.getSessionGenerationContext,
		{ sessionId },
	);

	expect(generationContext.needsLegacyContentReplacement).toBe(true);
});

test("multiple-choice tasks stay compact without losing plausible choices", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("rehearsal");

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const multipleChoiceItems =
		content?.items.filter((item) => item.kind === "multipleChoice") ?? [];

	expect(multipleChoiceItems.length).toBeGreaterThan(0);
	for (const item of multipleChoiceItems) {
		expect(item.prompt.length).toBeLessThanOrEqual(
			MAX_MULTIPLE_CHOICE_PROMPT_CHARS,
		);
		expect(item.choices).toHaveLength(MULTIPLE_CHOICE_OPTION_COUNT);
		expect(
			item.choices.every(
				(choice) => choice.text.length <= MAX_MULTIPLE_CHOICE_OPTION_CHARS,
			),
		).toBe(true);
	}
});

test("praxis fallback creates generalprobe tasks without generic strategy prompts", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("rehearsal");

	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const prompts = content?.items.map((item) => item.prompt).join(" ") ?? "";

	expect(content?.praxisDurationSeconds).toBe(30 * 60);
	expect(content?.items).toHaveLength(8);
	expect(prompts).toContain("Generalprobe");
	expect(prompts).not.toContain("Welche Strategie passt");
});

test("answers produce feedback and finishing creates a Wissensanalyse", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("rehearsal");
	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const multipleChoice = content?.items.find(
		(item) => item.kind === "multipleChoice",
	);
	const voice = content?.items.find((item) => item.kind === "voice");
	if (!multipleChoice || !voice) {
		throw new Error("Expected Praxis content to include MC and voice tasks.");
	}

	const wrongAttempt = await t.mutation(
		api.learningSessionContent.submitAnswer,
		{
			itemId: multipleChoice.id,
			selectedChoiceId: "distractor-fast",
			timeSpentSeconds: 20,
		},
	);
	const voiceAttempt = await t.mutation(
		api.learningSessionContent.submitAnswer,
		{
			itemId: voice.id,
			transcript:
				"Ich löse die Gleichung Schritt für Schritt und prüfe das Ergebnis.",
			timeSpentSeconds: 45,
		},
	);
	const analysis = await t.mutation(
		api.learningSessionContent.finishSessionContent,
		{ sessionId },
	);

	expect(wrongAttempt).toMatchObject({
		rating: "notCorrect",
		perfectAnswer: expect.stringContaining("prüfe"),
	});
	expect(voiceAttempt.rating).not.toBe("notCorrect");
	expect(analysis.strengths.length).toBeGreaterThan(0);
	expect(analysis.gaps.length).toBeGreaterThan(0);
	expect(analysis.recommendation).toContain("Wiederhole");

	const updatedContent = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);
	expect(updatedContent?.analysis?.id).toBe(analysis.id);
});

test("finishing analyzes only the latest attempt for each item", async () => {
	const { t, sessionId } = await createGeneratedPlanWithSession("rehearsal");
	await t.mutation(api.learningSessionContent.ensureSessionContent, {
		sessionId,
	});
	const content = await t.query(api.learningSessionContent.getSessionContent, {
		sessionId,
	});
	const multipleChoice = content?.items.find(
		(item) => item.kind === "multipleChoice",
	);
	if (!multipleChoice) {
		throw new Error(
			"Expected Praxis content to include a multiple choice task.",
		);
	}

	await t.mutation(api.learningSessionContent.submitAnswer, {
		itemId: multipleChoice.id,
		selectedChoiceId: "distractor-fast",
		timeSpentSeconds: 20,
	});
	await t.mutation(api.learningSessionContent.submitAnswer, {
		itemId: multipleChoice.id,
		selectedChoiceId: "correct",
		timeSpentSeconds: 15,
	});

	const analysis = await t.mutation(
		api.learningSessionContent.finishSessionContent,
		{ sessionId },
	);
	const updatedContent = await t.query(
		api.learningSessionContent.getSessionContent,
		{ sessionId },
	);

	expect(updatedContent?.attempts).toHaveLength(1);
	expect(updatedContent?.attempts[0]).toMatchObject({
		itemId: multipleChoice.id,
		rating: "correct",
	});
	expect(analysis.gaps).toEqual([
		"Halte die Sicherheit bis zur Prüfung durch kurze Wiederholung.",
	]);
});
