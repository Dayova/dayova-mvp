/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const user = {
	tokenIdentifier: "test:user",
};

const createGeneratedPlanWithSession = async (
	phase: "theory" | "practice" | "rehearsal",
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
				durationMinutes: 30,
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
